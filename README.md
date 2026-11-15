# CourtCoach AI

**[Open the live app](https://mykeil-tzul.github.io/courtcoach-ai/)**

CourtCoach AI turns three short basketball clips into a seven-day practice plan. It’s for players who can watch their film but want help deciding what to practice next. The goal is to make a film-to-workout routine available even when a player doesn’t have a coach or trainer watching every session.

## Try it

Start with **Explore sample review** for an example plan. The sample observations are fictional and separate from the GameLens footage shown in the header.

1. Add a profile with your position, skill level, playing style, goal, practice time, and available equipment.
2. Choose three clips. Identify yourself by jersey or position, mark a moment, and describe what you see. **Show AI pose** optionally overlays frame-level MediaPipe landmarks, and you can select your own marker when the player is clearly visible.
3. Confirm the observations and build the report. Each observation links back to its clip and timestamp. Your plan includes skill work, film review, and a repeatable test near the end of the week.
4. Track clean attempts in the local practice log, download the plan, and use the court or trainer search links to find places to practice.

## How the coaching works

[MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) supplies the AI pose overlay. The model can miss players in wide shots, crowded scenes, and clips with poor lighting. The overlay is for a paused frame and can’t follow an identity across the video.

A rule-based planner ranks verified improvement observations alongside the player’s goal, then retrieves drills from an equipment-tagged library. It adjusts the practice instructions by role, playing style, skill level, and the time available. Age and height are optional profile context. They do not change workout intensity. The report explains which observations contributed to the priority. The app does not infer skill weaknesses, shot quality, or tactical intent from video by itself.

No account is required. Videos and film notes remain in the current browser tab. The app downloads the pose model from Google and the pinned MediaPipe runtime from jsDelivr. Only practice-log entries are saved locally, and you can clear them. Maps and YouTube links open external searches. There is no trainer vetting or location tracking.

## Run and test

```sh
python3 -m http.server 8000 --directory site
node --test tests/*.test.mjs
```

Open `http://localhost:8000`. Try a short H.264 MP4 in a current Chrome or Edge browser. Clips are limited to 1–60 seconds and 120 MB each. GitHub Actions checks the coaching logic and deploys the static app to Pages. I chose client-side processing so the first version can show the film workflow without sending anyone’s videos to a server.

The header still is from Myke Tzul’s [GameLens](https://github.com/Mykeil-tzul/gamelens) project.
