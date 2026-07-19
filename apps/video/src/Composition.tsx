import { Composition } from "remotion";
import { LaunchVideo } from "./LaunchVideo";
import { DURATION, FPS } from "./video/kit";

export function VideoComposition() {
  return (
    <Composition
      id="LumaThreadLaunch"
      component={LaunchVideo}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
}
