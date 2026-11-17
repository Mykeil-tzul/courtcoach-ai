# CourtCoach AI

**[Open the live app](https://mykeil-tzul.github.io/courtcoach-ai/)**

CourtCoach AI turns three short basketball clips into a seven-day practice plan. It’s for players who can watch their film but want help deciding what to practice next. The goal is to make a film-to-workout routine available even when a player doesn’t have a coach or trainer watching every session.

## ShotDNA shooting lab

[Open ShotDNA](https://mykeil-tzul.github.io/courtcoach-ai/shotdna.html), also linked in the app’s navigation and hero. Use a side-on, steady-phone clip with one shooter fully visible.

1. Choose a local video or select **Analyze this clip** under one of Myke’s three practice recordings.
2. Pause at the gather, analyze the frame, choose the correct pose, and mark the gather.
3. Pause at the release, analyze it again, choose the same shooter, and mark the release.
4. Enter the observed make or miss if known, then add the attempt. Repeat to build a session.
5. Save the session with the camera and drill setup. Compare it with another session using the same setup name and shooting hand.

The report measures release elbow angle and gather knee angle in the image plane. It calculates elapsed time between the two manually selected frames. Landmarks must be inside the image and have visibility at least 0.65. Missing or degenerate joints produce no measurement. Aspect ratio is included in the angle calculation. Three or more attempts enable a standard-deviation view of how closely the measurements repeat.

The chart and journal show averages and spread. The app makes no claim that a tighter spread improves shooting accuracy. A marked time interval is not an automatically detected release. It cannot measure elbow alignment in depth, ball flight, release height, or identify the shooter across frames. Coach validation and camera-calibrated biomechanical accuracy remain pending.

**See an example report** uses six clearly labeled synthetic attempts to demonstrate the interface. Synthetic attempts cannot be saved as measured sessions. Actual measurements and a manually recorded outcome can be saved locally, exported, imported, compared, or deleted. Local video is held in memory and never included in the journal export. The optional model and runtime download from Google and jsDelivr. The journal holds up to 100 sessions with up to 100 shots each.

The numerical tests cover known geometric angles, aspect ratio, occlusion rejection, reversed timestamps, invalid imports, session statistics, and incompatible setups. A Chrome browser smoke test loaded the actual pose model on the game excerpt, marked two usable frames, saved a session, restored it after reload, imported a follow-up, compared the sessions, and rejected an invalid backup without replacing the journal. These checks verify the workflow. Real shooting accuracy or biomechanics validation has not been measured.

## My practice videos in ShotDNA

The shooting lab includes three full practice recordings selected from my Photos library, with playable previews and an **Analyze this clip** button. The purple-tee shooting session is about 18 seconds, the gym workout is about 62 seconds, and the shooting-machine clip is about nine seconds. Choosing a different clip starts a fresh measurement session and asks before discarding unsaved attempts.

The browser copies use H.264 MP4 video and stereo AAC audio with fast-start playback. HDR footage was tone-mapped for standard screens, the original orientation was preserved, and source metadata was removed. They retain the full recording length. Originals remain outside the public repository.

These are rear and three-quarter practice views. They are useful for inspecting what the model sees, but a consistent side-on recording remains a better setup for comparing image-plane arm and leg angles.

## Try it

Choose **Review real game film** for a guided walkthrough, or **Explore sample review** for an instant example plan. The sample observations are fictional and separate from the GameLens footage shown in the header.

1. Add a profile with your position, skill level, playing style, goal, practice time, and available equipment.
2. Choose three clips. Identify yourself by jersey or position, mark a moment, and describe what you see. **Show AI pose** optionally overlays frame-level MediaPipe landmarks, and you can select your own marker when the player is clearly visible.
3. Confirm the observations and build the report. Each observation links back to its clip and timestamp. Your plan includes skill work, film review, and a repeatable test near the end of the week.
4. Track clean attempts in the local practice log, download the plan, and use the court or trainer search links to find places to practice.

## Real-film walkthrough

The built-in review uses three clips published in GameLens: a half-court drive, a baseline-angle possession, and a transition play. Each opens at the moment discussed in a draft observation. Read the note, replay the clip, and confirm or edit what you see before generating a plan. Myke Tzul identified himself as jersey No. 3. The first two excerpts show No. 3 around 0:03.1 and 0:04. The transition excerpt is a tentative identification because the number is blurred. The observations are drafts awaiting coach review.

For a follow-up, log a baseline and a later result for the same drill with the same number of attempts. For example, a player could log clean reads out of ten under the same setup. The journal compares the latest entry with the first matching entry and displays the change in percentage points. No athlete results are prefilled.

## How the coaching works

[MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) supplies the AI pose overlay. The model can miss players in wide shots, crowded scenes, and clips with poor lighting. The overlay is for a paused frame and can’t follow an identity across the video.

A rule-based planner ranks verified improvement observations alongside the player’s goal, then retrieves drills from an equipment-tagged library. It adjusts the practice instructions by role, playing style, skill level, and the time available. Age and height are optional profile context. They do not change workout intensity. The report explains which observations contributed to the priority. The app does not infer skill weaknesses, shot quality, or tactical intent from video by itself.

No account is required. Videos and film notes remain in the current browser tab. The app downloads the pose model from Google and the pinned MediaPipe runtime from jsDelivr. Only practice-log entries are saved locally, and you can clear them. Maps and YouTube links open external searches. There is no trainer vetting or location tracking.

## Run and test

```sh
python3 -m http.server 8000 --directory site
node --test tests/*.test.mjs
```

Open `http://localhost:8000`. Try a short H.264 MP4 in a current Chrome or Edge browser. The original three-clip coaching review accepts clips of 1–60 seconds and 120 MB each. ShotDNA accepts clips of 1–120 seconds and 120 MB each. GitHub Actions checks the coaching logic and deploys the static app to Pages. I chose client-side processing so the first version can show the film workflow without sending anyone’s videos to a server.

The header still is from Myke Tzul’s [GameLens](https://github.com/Mykeil-tzul/gamelens) project.

The [No. 3 coach review and retest worksheet](site/coach-case-worksheet.txt) records the coach’s observations, one practice priority, and baseline and retest counts under the same conditions. The public walkthrough still uses draft observations. Coach feedback and measured drill results are pending.
