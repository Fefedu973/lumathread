import { useEffect } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  AmbientBackground,
  colors,
  CutFlashes,
  fonts,
  ProgressRail,
  SceneShell,
  useFontsReady,
  Vignette,
} from "./video/kit";
import { EndScene } from "./video/scenes/End";
import { GlassScene } from "./video/scenes/Glass";
import { HookScene } from "./video/scenes/Hook";
import { InstallScene } from "./video/scenes/Install";
import { InteractionScene } from "./video/scenes/Interaction";
import { LandingScene } from "./video/scenes/Landing";
import { PathsScene } from "./video/scenes/Paths";

export function LaunchVideo() {
  useFontsReady();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        backgroundColor: colors.background,
        color: colors.text,
        fontFamily: fonts.sans,
      }}
    >
      <Audio src={staticFile("music.wav")} />
      <AmbientBackground />

      <Sequence durationInFrames={120} name="01 Hook">
        <SceneShell duration={120}>
          <HookScene />
        </SceneShell>
      </Sequence>
      <Sequence from={120} durationInFrames={180} name="02 Paths">
        <SceneShell duration={180}>
          <PathsScene />
        </SceneShell>
      </Sequence>
      <Sequence from={300} durationInFrames={120} name="03 Glass">
        <SceneShell duration={120}>
          <GlassScene />
        </SceneShell>
      </Sequence>
      <Sequence from={420} durationInFrames={120} name="04 Interaction">
        <SceneShell duration={120}>
          <InteractionScene />
        </SceneShell>
      </Sequence>
      <Sequence from={540} durationInFrames={120} name="05 Install">
        <SceneShell duration={120}>
          <InstallScene />
        </SceneShell>
      </Sequence>
      <Sequence from={660} durationInFrames={120} name="06 Landing reveal">
        <SceneShell duration={120}>
          <LandingScene />
        </SceneShell>
      </Sequence>
      <Sequence from={780} durationInFrames={90} name="07 End card">
        <SceneShell duration={90} out="none">
          <EndScene />
        </SceneShell>
      </Sequence>

      <CutFlashes cuts={[120, 300, 420, 540, 660, 780]} />
      <Vignette />
      <ProgressRail />
    </AbsoluteFill>
  );
}
