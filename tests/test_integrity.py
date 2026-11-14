import json
import unittest

import pandas as pd

from integrity import DATA, FEATURES, metrics, simulate


class IntegrityTests(unittest.TestCase):
    def test_simulation_reproducible(self):
        games = pd.read_csv(DATA / "games.csv", dtype={"game_id": str}).head(200)
        first, *_ = simulate(games)
        second, *_ = simulate(games)
        pd.testing.assert_frame_equal(first, second)
        self.assertTrue(first[FEATURES].ge(0).all().all())

    def test_holdout_scores_and_feed_coverage(self):
        report = json.loads((DATA / "report.json").read_text())
        rows = pd.read_csv(DATA / "holdout.csv", dtype={"game_id": str})
        feeds = json.loads((DATA / "feeds.json").read_text())
        self.assertEqual(set(rows.game_id), set(feeds))
        self.assertTrue(rows.game_date.ge(report["cutoff"]).all())
        for label, flag in [("rules", "rule_alert"), ("model", "model_alert")]:
            self.assertEqual(metrics(rows.scenario.ne("Routine"), rows[flag]), report[label])
        self.assertEqual(json.loads((DATA.parent / "site" / "holdout.json").read_text()),
                         json.loads(rows.to_json(orient="records", double_precision=12)))
