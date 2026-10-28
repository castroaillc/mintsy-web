import { Composition } from "remotion";

import {
  calculateCollageMetadata,
  CollageEpisode,
} from "./collage/CollageEpisode";
import { calculateEpisodeMetadata, Episode } from "./episode/Episode";
import { FPS, HEIGHT, WIDTH } from "./episode/timing";
import {
  calculatePrototypeMetadata,
  CollagePrototype,
  IllustratedPrototype,
} from "./prototypes/StylePrototype";

// The pipeline renders "Episode" with generated props; these defaults are a sample for previewing the templates.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CollageEpisode"
        component={CollageEpisode}
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={calculateCollageMetadata}
        defaultProps={{
          bookTitle: "How to Live on 24 Hours a Day",
          chapter: 1,
          episodeTitle: "The Daily Miracle",
          scenes: [
            {
              narration: "",
              audio: "",
              audioSec: 6,
              cueSec: { "second beat": 3 },
              beats: [
                {
                  startCue: "",
                  background: "mint" as const,
                  beat: {
                    layout: "stage" as const,
                    caption: "Always in a mess",
                    captionCue: "",
                    props: [
                      {
                        kind: "figure" as const,
                        hat: "bowler" as const,
                        mood: "happy" as const,
                        outfit: "plum" as const,
                        label: "",
                        cue: "",
                      },
                      {
                        kind: "icon" as const,
                        icon: "briefcase" as const,
                        color: "gold" as const,
                        label: "Good job",
                        cue: "",
                      },
                      {
                        kind: "icon" as const,
                        icon: "food" as const,
                        color: "pink" as const,
                        label: "Bad mutton",
                        cue: "",
                      },
                    ],
                  },
                },
                {
                  startCue: "second beat",
                  background: "plum" as const,
                  beat: {
                    layout: "headline" as const,
                    lines: [
                      {
                        text: "Live on £85 a year",
                        highlight: "£85 a year",
                        cue: "",
                      },
                      {
                        text: "Live on 24 hours a day",
                        highlight: "24 hours",
                        cue: "",
                      },
                    ],
                    numbered: true,
                    stamp: { text: "Never written", cue: "" },
                  },
                },
              ],
            },
            {
              narration: "",
              audio: "",
              audioSec: 4,
              cueSec: {},
              beats: [
                {
                  startCue: "",
                  background: "cream" as const,
                  beat: {
                    layout: "counter" as const,
                    title: "A daily miracle",
                    icon: "wallet" as const,
                    color: "pink" as const,
                    value: 24,
                    prefix: "",
                    suffix: " hrs",
                    label: "Fresh every morning",
                    cue: "",
                  },
                },
              ],
            },
            {
              narration: "",
              audio: "",
              audioSec: 4,
              cueSec: {},
              beats: [
                {
                  startCue: "",
                  background: "slate" as const,
                  beat: {
                    layout: "lineup" as const,
                    heading: "Nobody gets more",
                    members: [
                      {
                        kind: "figure" as const,
                        hat: "top" as const,
                        mood: "neutral" as const,
                        outfit: "plum" as const,
                        label: "Rich",
                        cue: "",
                      },
                      {
                        kind: "figure" as const,
                        hat: "grad" as const,
                        mood: "neutral" as const,
                        outfit: "teal" as const,
                        label: "Brilliant",
                        cue: "",
                      },
                      {
                        kind: "figure" as const,
                        hat: "cap" as const,
                        mood: "happy" as const,
                        outfit: "pink" as const,
                        label: "Everyone",
                        cue: "",
                      },
                    ],
                    badge: "24",
                    badgeCue: "",
                  },
                },
              ],
            },
            {
              narration: "",
              audio: "",
              audioSec: 4,
              cueSec: {},
              beats: [
                {
                  startCue: "",
                  background: "pink" as const,
                  beat: {
                    layout: "versus" as const,
                    left: {
                      label: "Money",
                      prop: {
                        kind: "icon" as const,
                        icon: "coins" as const,
                        color: "gold" as const,
                        label: "",
                        cue: "",
                      },
                      points: [
                        { text: "Can earn more", cue: "" },
                        { text: "Can borrow", cue: "" },
                      ],
                    },
                    right: {
                      label: "Time",
                      prop: {
                        kind: "icon" as const,
                        icon: "hourglass" as const,
                        color: "teal" as const,
                        label: "",
                        cue: "",
                      },
                      points: [
                        { text: "Fixed supply", cue: "" },
                        { text: "No debt", cue: "" },
                      ],
                    },
                    winner: "right" as const,
                    verdictCue: "",
                  },
                },
              ],
            },
            {
              narration: "",
              audio: "",
              audioSec: 4,
              cueSec: {},
              beats: [
                {
                  startCue: "",
                  background: "plum" as const,
                  beat: {
                    layout: "takeaways" as const,
                    heading: "Key takeaways",
                    items: [
                      { text: "Time is scarcer than money", cue: "" },
                      { text: "Fresh 24 hours every morning", cue: "" },
                      { text: "Stop waiting for more time", cue: "" },
                    ],
                  },
                },
              ],
            },
          ],
        }}
      />
      <Composition
        id="CollagePrototype"
        component={CollagePrototype}
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={calculatePrototypeMetadata}
        defaultProps={{
          bookTitle: "How to Live on 24 Hours a Day",
          chapter: 1,
          episodeTitle: "The Daily Miracle",
          clips: [
            { audio: "", audioSec: 23.5 },
            { audio: "", audioSec: 15.3 },
            { audio: "", audioSec: 25.4 },
          ],
        }}
      />
      <Composition
        id="IllustratedPrototype"
        component={IllustratedPrototype}
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={calculatePrototypeMetadata}
        defaultProps={{
          bookTitle: "How to Live on 24 Hours a Day",
          chapter: 1,
          episodeTitle: "The Daily Miracle",
          clips: [
            { audio: "", audioSec: 23.5 },
            { audio: "", audioSec: 15.3 },
            { audio: "", audioSec: 25.4 },
          ],
        }}
      />
      <Composition
        id="Episode"
        component={Episode}
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={calculateEpisodeMetadata}
        defaultProps={{
          bookTitle: "The Psychology of Money",
          chapter: 4,
          episodeTitle: "Confounding Compounding",
          author: "Morgan Housel",
          tint: "#3B3426",
          scenes: [
            {
              narration: "",
              audio: "",
              audioSec: 3,
              cueSec: {},
              visual: {
                type: "title",
                kicker: "Chapter 4",
                headline: "Confounding Compounding",
              },
            },
            {
              narration: "",
              audio: "",
              audioSec: 3.5,
              cueSec: {},
              visual: {
                type: "statement",
                headline: "Time matters more than the rate of return",
                emphasis: "Time",
              },
            },
            {
              narration: "",
              audio: "",
              audioSec: 4,
              cueSec: {},
              visual: {
                type: "stat",
                value: "$81.5B",
                label: "of Buffett's fortune came after his 65th birthday",
              },
            },
            {
              narration: "",
              audio: "",
              audioSec: 5,
              cueSec: {},
              visual: {
                type: "compare",
                left: {
                  label: "Chasing returns",
                  points: [
                    { text: "Highest possible rate", cue: "" },
                    { text: "Hard to stick with", cue: "" },
                  ],
                },
                right: {
                  label: "Staying power",
                  points: [
                    { text: "Good, steady returns", cue: "" },
                    { text: "Held for decades", cue: "" },
                  ],
                },
              },
            },
            {
              narration: "",
              audio: "",
              audioSec: 5,
              cueSec: {},
              visual: {
                type: "takeaways",
                heading: "Key takeaways",
                items: [
                  { text: "Time beats the rate of return", cue: "" },
                  { text: "Pick returns you can sustain", cue: "" },
                  { text: "Don't interrupt compounding", cue: "" },
                ],
              },
            },
          ],
        }}
      />
    </>
  );
};
