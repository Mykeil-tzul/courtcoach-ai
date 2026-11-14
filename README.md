# NBA Integrity Intelligence

[**Open the live review desk**](https://mykeil-tzul.github.io/nba-integrity-intelligence/)

I built this project to explore how an analyst might review unusual market activity without treating every unusual move as suspicious. The demo uses completed NBA game records for context and fictional quote feeds to test which alerts an analyst would see.

## Try it

1. Pick **Isolation Forest** or **Threshold rules** and move the alert cutoff. Watch the queue, precision, recall, and false alert count change.
2. Open an alert and inspect the primary and reference quotes one tick at a time. The review panel also shows how old each update is.
3. Select **Find a routine alert**, reveal the simulation label, and decide whether to dismiss the case or mark it for follow-up. Review notes and decisions stay in memory for the current visit.

## Data and evaluation

I took game dates, IDs, appearance counts, and combined box-score points from my [NBA Cloud Data Platform](https://github.com/Mykeil-tzul/nba-cloud-data-platform). The snapshot contains 5,100 games. Game data gives each case context. The model scores only three market features from the simulated feed.

The generator assigns fictional price jumps, feed disagreements, and stale updates. It also includes routine volatility. A rule flags large values in any of three signals. Isolation Forest scores unusual combinations of the same signals. I fit it on 3,830 earlier games and fixed the cutoff using the training score distribution. The 1,270 later games include 98 injected events.

| Default method | Precision | Recall | False alerts |
| --- | ---: | ---: | ---: |
| Threshold rules | 100.0% | 71.4% | 0 |
| Isolation Forest | 98.6% | 71.4% | 1 |

Both caught 70 injected events at their default cutoffs. The rule caught the same number with one fewer false alarm. The threshold slider shows how changing the cutoff changes the review workload. These numbers describe this simulation and don’t establish accuracy on live markets. Individual alerts are fictional and make no allegation about the real games.

## Reproduce and run locally

```bash
python -m pip install -r requirements-training.txt
python integrity.py
python -m unittest discover -s tests -v
python -m http.server 8000 --directory site
```

Open `http://localhost:8000`. Training writes the evaluated rows, market ticks, and metrics to `data/` and copies the browser-ready results to `site/`. The public review desk runs on GitHub Pages. It uses the prepared scores and updates the review queue in the browser.
