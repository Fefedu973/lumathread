import { Check, Code2, Terminal } from "lucide-react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import {
  clamp,
  colors,
  fadeUp,
  fonts,
  SceneTag,
  Surface,
  WindowDots,
} from "../kit";

const INSTALL =
  "bunx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json";
const COMPONENT = 'import { LumaThread } from "@/components/ui/lumathread";';

function typed(frame: number, text: string, start: number, end: number) {
  const count = Math.floor(
    clamp(frame, [start, end], [0, text.length], Easing.linear),
  );
  return text.slice(0, count);
}

function Caret({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.62em",
        height: "1.15em",
        marginLeft: 3,
        verticalAlign: "text-bottom",
        background: colors.text,
        opacity: on ? 1 : 0,
      }}
    />
  );
}

export function InstallScene() {
  const frame = useCurrentFrame();
  const install = typed(frame, INSTALL, 10, 42);
  const component = typed(frame, COMPONENT, 58, 100);
  const installDone = frame >= 42;
  const componentDone = frame >= 100;
  const caret = frame % 14 < 8;

  return (
    <AbsoluteFill>
      <SceneTag index="04" text="SHADCN REGISTRY" frame={frame} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 110,
          textAlign: "center",
          fontSize: 122,
          fontWeight: 800,
          letterSpacing: -6,
          ...fadeUp(frame, 2, 13, 46),
        }}
      >
        OWN THE SOURCE.
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 330,
          display: "flex",
          justifyContent: "center",
          perspective: 1700,
          ...fadeUp(frame, 6, 15, 90),
        }}
      >
        <div
          style={{
            width: 1500,
            transform: `rotateX(${clamp(frame, [0, 40], [8, 3.5])}deg) rotateY(-2.5deg) skewX(-0.6deg) scale(${clamp(frame, [0, 118], [0.99, 1.045], Easing.inOut(Easing.quad))})`,
          }}
        >
          <Surface style={{ paddingBottom: 40 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                height: 66,
                paddingInline: 30,
                borderBottom: `1px solid ${colors.line}`,
                color: colors.muted,
              }}
            >
              <Terminal size={24} />
              <span style={{ fontSize: 21, fontWeight: 600 }}>
                shadcn registry
              </span>
              <div style={{ marginLeft: "auto" }}>
                <WindowDots />
              </div>
            </div>
            <div
              style={{
                padding: "36px 44px 0",
                fontFamily: fonts.mono,
                fontSize: 29,
                lineHeight: 1.45,
                whiteSpace: "nowrap",
              }}
            >
              <div>
                <span style={{ color: colors.faint }}>$ </span>
                <span>{install}</span>
                {!installDone ? <Caret on={caret} /> : null}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 18,
                  color: colors.green,
                  fontSize: 26,
                  opacity: clamp(frame, [43, 49], [0, 1]),
                }}
              >
                <Check size={26} strokeWidth={3} />
                38 typed source files installed
                <span style={{ color: colors.faint }}>
                  — editable, local, no black box
                </span>
              </div>
              <div
                style={{
                  marginTop: 28,
                  opacity: clamp(frame, [54, 59], [0, 1]),
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12,
                    color: colors.muted,
                    fontFamily: fonts.sans,
                    fontSize: 20,
                  }}
                >
                  <Code2 size={21} /> components/ui/lumathread/index.ts
                </div>
                <div>
                  <span style={{ color: colors.cyan }}>{component}</span>
                  {!componentDone ? <Caret on={caret} /> : null}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 18,
                  color: colors.green,
                  fontSize: 26,
                  opacity: clamp(frame, [101, 107], [0, 1]),
                }}
              >
                <Check size={26} strokeWidth={3} />
                component ready
                <span style={{ color: colors.faint }}>
                  — deterministic, typed, composable
                </span>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </AbsoluteFill>
  );
}
