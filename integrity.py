"""Reproducible simulation, chronological scoring, and alert metrics."""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent / "data"
FEATURES = ["max_move", "max_gap", "max_age"]
PATTERNS = ("Routine", "Price jump", "Feed disagreement", "Stale update")


def simulate(games, seed=42):
    rng = np.random.default_rng(seed)
    count = len(games)
    labels = rng.choice(PATTERNS, count, p=[.91, .03, .03, .03])
    quote = 100 + rng.normal(0, .65, (count, 18)).cumsum(axis=1)
    noise = rng.normal(0, .45, quote.shape)
    age = rng.uniform(.2, 4, quote.shape)
    volatility = rng.choice([1, 1.9], count, p=[.93, .07])
    quote = 100 + (quote - 100) * volatility[:, None]
    peer = quote + noise
    for row, label in enumerate(labels):
        tick = rng.integers(5, 14)
        if label == "Price jump":
            quote[row, tick:] += rng.uniform(2.5, 7)
            peer[row, tick:] += quote[row, tick] - peer[row, tick]
        elif label == "Feed disagreement":
            peer[row, tick:tick + 3] += rng.uniform(2, 7)
        elif label == "Stale update":
            age[row, tick:tick + 3] += rng.uniform(3, 16)
    features = games.reset_index(drop=True).copy()
    features["scenario"] = labels
    features["max_move"] = np.abs(np.diff(quote, axis=1)).max(axis=1)
    features["max_gap"] = np.abs(quote - peer).max(axis=1)
    features["max_age"] = age.max(axis=1)
    return features, quote, peer, age


def metrics(truth, flagged):
    truth, flagged = np.asarray(truth, dtype=bool), np.asarray(flagged, dtype=bool)
    tp = int((truth & flagged).sum())
    fp = int((~truth & flagged).sum())
    fn = int((truth & ~flagged).sum())
    tn = int((~truth & ~flagged).sum())
    return dict(tp=tp, fp=fp, fn=fn, tn=tn, precision=tp / max(1, tp + fp),
                recall=tp / max(1, tp + fn), false_positive_rate=fp / max(1, fp + tn))


def build():
    from sklearn.ensemble import IsolationForest

    games = pd.read_csv(DATA / "games.csv", dtype={"game_id": str})
    games = games.sort_values(["game_date", "game_id"], ignore_index=True)
    frame, quote, peer, age = simulate(games)
    dates = frame.game_date.unique()
    cutoff = dates[int(len(dates) * .75)]
    training = frame.game_date.lt(cutoff)
    model = IsolationForest(n_estimators=150, random_state=42, n_jobs=1)
    model.fit(frame.loc[training, FEATURES])
    score = -model.score_samples(frame[FEATURES])
    frame["model_score"] = score
    frame["rule_score"] = frame[FEATURES].div([4, 3.5, 10]).max(axis=1)
    holdout = frame.loc[~training].copy()
    threshold = float(np.quantile(score[training], .93))
    holdout["rule_alert"] = holdout.rule_score.ge(1)
    holdout["model_alert"] = holdout.model_score.ge(threshold)
    actual = holdout.scenario.ne("Routine")
    report = dict(
        training_rows=int(training.sum()), cutoff=cutoff, test_rows=len(holdout),
        model_threshold=threshold, injected=int(actual.sum()),
        rules=metrics(actual, holdout.rule_alert), model=metrics(actual, holdout.model_alert),
    )
    holdout.to_csv(DATA / "holdout.csv", index=False, float_format="%.10g")
    feeds = {
        row.game_id: {
            "primary": quote[index].round(3).tolist(), "reference": peer[index].round(3).tolist(),
            "age": age[index].round(3).tolist(),
        }
        for index, row in holdout.iterrows()
    }
    (DATA / "feeds.json").write_text(json.dumps(feeds, separators=(",", ":")) + "\n")
    (DATA / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    site = DATA.parent / "site"
    rows = pd.read_csv(DATA / "holdout.csv", dtype={"game_id": str})
    rows.to_json(site / "holdout.json", orient="records", double_precision=12)
    for name in ("feeds.json", "report.json"):
        (site / name).write_bytes((DATA / name).read_bytes())
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    build()
