import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import {
  condensed,
  Cutout,
  Figure,
  KineticLine,
  palette,
  Pop,
  StampX,
  Stripes,
  useAt,
  usePop,
} from "../../collage/kit";

/* Prototype choreography: times are seconds into each scene, taken from the narration's word timings. */

const Coin: React.FC<{ size?: number }> = ({ size = 54 }) => (
  <svg width={size} height={size} viewBox="0 0 54 54">
    <circle
      cx="27"
      cy="27"
      r="25"
      fill={palette.gold}
      stroke={palette.ink}
      strokeWidth="3"
    />
    <text
      x="27"
      y="36"
      textAnchor="middle"
      fontFamily={condensed}
      fontWeight="700"
      fontSize="26"
      fill={palette.ink}
    >
      £
    </text>
  </svg>
);

const Briefcase = () => (
  <svg width="110" height="90" viewBox="0 0 110 90">
    <rect
      x="38"
      y="4"
      width="34"
      height="18"
      rx="5"
      fill="none"
      stroke={palette.ink}
      strokeWidth="6"
    />
    <rect
      x="4"
      y="18"
      width="102"
      height="68"
      rx="8"
      fill="#8A5A34"
      stroke={palette.ink}
      strokeWidth="4"
    />
    <rect x="4" y="42" width="102" height="6" fill={palette.ink} />
  </svg>
);

const Glass = () => (
  <svg width="70" height="120" viewBox="0 0 70 120">
    <path
      d="M8 6 H62 L52 52 Q35 66 18 52 Z"
      fill={palette.white}
      stroke={palette.ink}
      strokeWidth="4"
    />
    <path d="M14 30 H56 L52 52 Q35 64 18 52 Z" fill="#8E2246" />
    <rect x="32" y="60" width="6" height="44" fill={palette.ink} />
    <rect x="14" y="102" width="42" height="8" rx="4" fill={palette.ink} />
  </svg>
);

const BadMutton = () => {
  const frame = useCurrentFrame();
  return (
    <svg
      width="170"
      height="120"
      viewBox="0 0 170 120"
      style={{ overflow: "visible" }}
    >
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${55 + i * 30} 40 q-10 -12 0 -24 q10 -12 0 -24`}
          stroke="#7FA34A"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          transform={`translate(0 ${Math.sin(frame / 6 + i) * 3})`}
        />
      ))}
      <ellipse
        cx="85"
        cy="92"
        rx="80"
        ry="24"
        fill={palette.white}
        stroke={palette.ink}
        strokeWidth="4"
      />
      <path d="M50 88 q35 -40 70 0 Z" fill="#9C6B4A" />
      <rect
        x="112"
        y="72"
        width="34"
        height="9"
        rx="4"
        fill={palette.cream}
        stroke={palette.ink}
        strokeWidth="3"
      />
    </svg>
  );
};

const Chair = () => (
  <svg width="90" height="130" viewBox="0 0 90 130">
    <rect
      x="10"
      y="4"
      width="70"
      height="60"
      rx="6"
      fill={palette.pink}
      stroke={palette.ink}
      strokeWidth="4"
    />
    <rect
      x="4"
      y="62"
      width="82"
      height="16"
      rx="5"
      fill={palette.pink}
      stroke={palette.ink}
      strokeWidth="4"
    />
    <rect x="12" y="78" width="8" height="48" fill={palette.ink} />
    <rect x="70" y="78" width="8" height="48" fill={palette.ink} />
  </svg>
);

/** "Picture a man with a good job…": a puppet assembled from the details as they're named. */
export const ManScene: React.FC = () => {
  const frame = useCurrentFrame();
  const at = useAt();
  // At "Arnold Bennett" the room makes way for the book
  const toBook = interpolate(frame, [at(20.2), at(20.8)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const suitOn = frame >= at(12.3);
  return (
    <AbsoluteFill>
      <Stripes a={palette.mint} b={palette.teal} />
      <AbsoluteFill style={{ translate: `0 ${-toBook * 720}px` }}>
        <Pop at={0.1} x={640} y={380}>
          <Cutout style={{ width: 760, height: 470, borderRadius: 4 }} />
        </Pop>
        {/* Wall frame: a lovely flat… */}
        <Pop at={9.4} x={470} y={250} rotate={-3}>
          <div
            style={{
              width: 120,
              height: 90,
              border: `8px solid ${palette.ink}`,
              backgroundColor: palette.yellow,
            }}
          />
        </Pop>
        {/* …but half empty */}
        <Pop at={10.5} x={860} y={480}>
          <Chair />
        </Pop>
        <Pop at={0.5} x={640} y={420}>
          <Figure
            body={suitOn ? palette.plum : palette.slate}
            hat="bowler"
            hatAt={14.1}
            scale={1.05}
          />
        </Pop>
        <Pop at={1.0} x={420} y={520} rotate={-6}>
          <Briefcase />
        </Pop>
        {[0, 1, 2].map((i) => (
          <Pop key={i} at={3.6 + i * 0.25} x={330 + i * 46} y={300 - i * 22}>
            <Coin />
          </Pop>
        ))}
        <Pop at={17.4} x={980} y={300} rotate={8}>
          <Glass />
        </Pop>
        <Pop at={19.2} x={980} y={520}>
          <BadMutton />
        </Pop>
        {/* Tape label */}
        <Pop at={8.1} x={640} y={120} rotate={-4}>
          <div
            style={{
              backgroundColor: palette.pink,
              padding: "6px 26px",
              boxShadow: `6px 6px 0 ${palette.ink}`,
            }}
          >
            <KineticLine at={8.15} size={64}>
              Always in a mess
            </KineticLine>
          </div>
        </Pop>
      </AbsoluteFill>
      <AbsoluteFill style={{ translate: `0 ${(1 - toBook) * 720}px` }}>
        <Stripes a={palette.pink} b={palette.yellow} width={40} />
        <Pop at={20.6} x={640} y={360} rotate={-4}>
          <Cutout
            color={palette.cream}
            style={{
              width: 430,
              padding: "46px 40px",
              border: `6px solid ${palette.ink}`,
            }}
          >
            <KineticLine at={20.9} size={72} color={palette.ink}>
              How to live
            </KineticLine>
            <KineticLine at={21.1} size={72} color={palette.pink}>
              on 24 hours
            </KineticLine>
            <KineticLine at={21.3} size={72} color={palette.ink}>
              a day
            </KineticLine>
            <div
              style={{
                height: 6,
                backgroundColor: palette.ink,
                margin: "18px 0",
              }}
            />
            <KineticLine at={21.7} size={34} color={palette.slate}>
              Arnold Bennett
            </KineticLine>
          </Cutout>
        </Pop>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** "Readers wrote furious letters…": the money advice stacks up; the time advice was never written. */
export const AdviceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const at = useAt();
  const dim = interpolate(frame, [at(11.2), at(11.8)], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: palette.plum }}>
      <Stripes a={palette.plum} b="#3A2C66" width={34} />
      {/* Furious letters flutter in */}
      {[0, 1, 2, 3].map((i) => (
        <Pop
          key={i}
          at={0.8 + i * 0.3}
          x={1120 + (i % 2) * 70}
          y={110 + i * 150}
          rotate={-12 + i * 9}
        >
          <svg
            width="120"
            height="80"
            viewBox="0 0 120 80"
            style={{ opacity: dim }}
          >
            <rect
              x="2"
              y="2"
              width="116"
              height="76"
              fill={palette.white}
              stroke={palette.ink}
              strokeWidth="4"
            />
            <path
              d="M2 2 L60 46 L118 2"
              fill="none"
              stroke={palette.ink}
              strokeWidth="4"
            />
          </svg>
        </Pop>
      ))}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 150,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ opacity: dim }}>
          <KineticLine at={5.4} size={70} dot={1} dotColor={palette.pink}>
            <span>
              Live on <span style={{ color: palette.pink }}>£85 a year</span>
            </span>
          </KineticLine>
        </div>
        <div style={{ opacity: dim }}>
          <KineticLine at={9.0} size={70} dot={2} dotColor={palette.yellow}>
            <span>
              Live on{" "}
              <span style={{ color: palette.yellow }}>8 shillings a week</span>
            </span>
          </KineticLine>
        </div>
        <div style={{ position: "relative" }}>
          <KineticLine at={13.2} size={70} dot={3} dotColor={palette.mint}>
            <span>
              Live on{" "}
              <span style={{ color: palette.mint }}>24 hours a day</span>
            </span>
          </KineticLine>
          <Pop at={13.9} x={330} y={150} rotate={-6}>
            <div
              style={{
                border: `7px solid ${palette.pink}`,
                color: palette.pink,
                fontFamily: condensed,
                fontWeight: 700,
                fontSize: 54,
                padding: "2px 22px",
                letterSpacing: 3,
                backgroundColor: "rgba(43,31,78,0.75)",
              }}
            >
              NEVER WRITTEN
            </div>
          </Pop>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Purse: React.FC<{ fill: number }> = ({ fill }) => (
  <svg
    width="300"
    height="240"
    viewBox="0 0 300 240"
    style={{ overflow: "visible" }}
  >
    <path
      d="M95 60 Q150 -10 205 60"
      fill="none"
      stroke={palette.ink}
      strokeWidth="12"
    />
    <path
      d="M30 70 H270 L250 225 Q150 245 50 225 Z"
      fill="#B0573A"
      stroke={palette.ink}
      strokeWidth="6"
    />
    <rect
      x="30"
      y="62"
      width="240"
      height="22"
      rx="8"
      fill={palette.gold}
      stroke={palette.ink}
      strokeWidth="6"
    />
    <text
      x="150"
      y="175"
      textAnchor="middle"
      fontFamily={condensed}
      fontWeight="700"
      fontSize="92"
      fill={palette.cream}
    >
      {fill}
    </text>
  </svg>
);

const ClockCoin = () => (
  <svg width="44" height="44" viewBox="0 0 44 44">
    <circle
      cx="22"
      cy="22"
      r="19"
      fill={palette.cream}
      stroke={palette.ink}
      strokeWidth="4"
    />
    <path
      d="M22 10 V22 L30 27"
      stroke={palette.ink}
      strokeWidth="4"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

/** "Your purse has been filled overnight with twenty-four fresh hours…" */
export const MiracleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const at = useAt();
  const sunrise = interpolate(frame, [at(3.4), at(5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Hours drop in one by one from "twenty-four"
  const dropStart = at(6.2);
  const filled = Math.max(
    0,
    Math.min(24, Math.floor((frame - dropStart) / 2.2)),
  );
  const toPeople = interpolate(frame, [at(16.6), at(17.2)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const samePop = usePop(at(23.0));
  return (
    <AbsoluteFill style={{ backgroundColor: palette.cream }}>
      <Stripes a={palette.cream} b="#EAD3A6" width={40} />
      <AbsoluteFill style={{ translate: `${-toPeople * 1280}px 0` }}>
        {/* Sun rising behind the purse */}
        <div
          style={{
            position: "absolute",
            left: 640 - 210,
            top: 430 - sunrise * 260,
            width: 420,
            height: 420,
            borderRadius: "50%",
            backgroundColor: palette.yellow,
            opacity: sunrise,
          }}
        />
        <Pop at={0.4} x={640} y={470}>
          <Purse fill={filled} />
        </Pop>
        {Array.from({ length: 24 }, (_, i) => {
          const start = dropStart + i * 2.2;
          const t = interpolate(frame, [start, start + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (t <= 0 || t >= 1) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 560 + ((i * 37) % 160),
                top: -60 + t * 480,
                rotate: `${i * 40}deg`,
              }}
            >
              <ClockCoin />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 90, top: 110 }}>
          <KineticLine at={1.6} size={70} color={palette.ink}>
            A daily
          </KineticLine>
          <KineticLine at={1.9} size={70} color={palette.pink}>
            miracle
          </KineticLine>
        </div>
        {/* A thief tries his luck */}
        <Pop at={9.8} x={1030} y={450}>
          <div style={{ position: "relative" }}>
            <Figure body={palette.ink} />
            <StampX at={10.6} size={170} />
          </div>
        </Pop>
        <div
          style={{
            position: "absolute",
            right: 70,
            top: 110,
            textAlign: "right",
          }}
        >
          <KineticLine at={14.6} size={58} color={palette.ink}>
            The perfect democracy
          </KineticLine>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ translate: `${(1 - toPeople) * 1280}px 0` }}>
        {[
          {
            x: 330,
            hat: "top" as const,
            body: palette.plum,
            at: 17.2,
            label: "Rich",
          },
          {
            x: 640,
            hat: "grad" as const,
            body: palette.teal,
            at: 20.1,
            label: "Brilliant",
          },
          {
            x: 950,
            hat: "none" as const,
            body: palette.slate,
            at: 23.0,
            label: "Everyone",
          },
        ].map((p, i) => (
          <div key={i}>
            <Pop at={p.at} x={p.x} y={400}>
              <Figure
                body={p.body}
                hat={p.hat}
                hatAt={p.at + 0.3}
                blinkOffset={i * 37}
              />
            </Pop>
            <Pop at={p.at + 0.2} x={p.x} y={590}>
              <div
                style={{
                  fontFamily: condensed,
                  fontWeight: 700,
                  fontSize: 40,
                  color: palette.ink,
                  textTransform: "uppercase",
                }}
              >
                {p.label}
              </div>
            </Pop>
            <div
              style={{
                position: "absolute",
                left: p.x + 40,
                top: 210,
                scale: String(samePop),
                backgroundColor: palette.gold,
                border: `5px solid ${palette.ink}`,
                borderRadius: "50%",
                width: 92,
                height: 92,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: condensed,
                fontWeight: 700,
                fontSize: 46,
                color: palette.ink,
              }}
            >
              24
            </div>
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
