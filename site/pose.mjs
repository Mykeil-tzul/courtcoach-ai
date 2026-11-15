import {FilesetResolver, PoseLandmarker} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";

export async function openPose() {
  const files=await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm");
  return PoseLandmarker.createFromOptions(files,{
    baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",delegate:"CPU"},
    runningMode:"IMAGE",numPoses:4,minPoseDetectionConfidence:0.55,minPosePresenceConfidence:0.55
  });
}

export const links=PoseLandmarker.POSE_CONNECTIONS;
