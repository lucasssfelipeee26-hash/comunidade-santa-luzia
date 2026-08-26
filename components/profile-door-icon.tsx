export function ProfileDoorIcon({
  className = "size-6",
  animated = true,
  loop = false,
  direction = "enter",
}: {
  className?: string
  animated?: boolean
  loop?: boolean
  direction?: "enter" | "exit"
}) {
  const classes = [
    className,
    "sl-profile-door-icon",
    animated ? "is-animated" : "",
    loop ? "is-looping" : "",
    direction === "exit" ? "is-exit" : "is-enter",
  ].filter(Boolean).join(" ")

  return (
    <svg viewBox="0 0 24 24" fill="none" className={classes} aria-hidden="true">
      <style>{`
        .sl-profile-door-icon { overflow:visible; }
        .sl-profile-door-icon .sl-door-leaf,
        .sl-profile-door-icon .sl-person,
        .sl-profile-door-icon .sl-person-facing,
        .sl-profile-door-icon .sl-arm-front,
        .sl-profile-door-icon .sl-arm-back,
        .sl-profile-door-icon .sl-leg-front,
        .sl-profile-door-icon .sl-leg-back {
          transform-box:fill-box;
          will-change:transform,opacity;
        }
        .sl-profile-door-icon .sl-door-leaf { transform-origin:100% 50%; }
        .sl-profile-door-icon .sl-person { transform-origin:center; }
        .sl-profile-door-icon .sl-person-facing { transform-origin:center; }
        .sl-profile-door-icon.is-enter .sl-person-facing { transform:scaleX(1); }
        .sl-profile-door-icon.is-exit .sl-person-facing { transform:scaleX(-1); }
        .sl-profile-door-icon .sl-arm-front,
        .sl-profile-door-icon .sl-arm-back { transform-origin:50% 12%; }
        .sl-profile-door-icon .sl-leg-front,
        .sl-profile-door-icon .sl-leg-back { transform-origin:50% 4%; }

        .sl-profile-door-icon.is-animated.is-enter .sl-door-leaf { animation:slDoorEnterLeaf 1.85s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-enter .sl-person { animation:slDoorPersonEnter 1.85s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-enter .sl-arm-front { animation:slDoorWaveEnter 1.85s ease-in-out both; }
        .sl-profile-door-icon.is-animated.is-enter .sl-arm-back { animation:slWalkArmBack 420ms ease-in-out 3 alternate; }
        .sl-profile-door-icon.is-animated.is-enter .sl-leg-front { animation:slWalkLegFront 420ms ease-in-out 3 alternate; }
        .sl-profile-door-icon.is-animated.is-enter .sl-leg-back { animation:slWalkLegBack 420ms ease-in-out 3 alternate; }

        .sl-profile-door-icon.is-animated.is-exit .sl-door-leaf { animation:slDoorExitLeaf 1.85s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-exit .sl-person { animation:slDoorPersonExit 1.85s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-exit .sl-arm-front { animation:slWalkArmFront 420ms ease-in-out 3 alternate; }
        .sl-profile-door-icon.is-animated.is-exit .sl-arm-back { animation:slWalkArmBack 420ms ease-in-out 3 alternate; }
        .sl-profile-door-icon.is-animated.is-exit .sl-leg-front { animation:slWalkLegFront 420ms ease-in-out 3 alternate; }
        .sl-profile-door-icon.is-animated.is-exit .sl-leg-back { animation:slWalkLegBack 420ms ease-in-out 3 alternate; }

        .sl-profile-door-icon.is-looping.is-enter .sl-door-leaf { animation:slDoorEnterLeafLoop 4.6s cubic-bezier(.2,.72,.2,1) infinite; }
        .sl-profile-door-icon.is-looping.is-enter .sl-person { animation:slDoorPersonEnterLoop 4.6s cubic-bezier(.2,.72,.2,1) infinite; }
        .sl-profile-door-icon.is-looping.is-exit .sl-door-leaf { animation:slDoorExitLeafLoop 4.6s cubic-bezier(.2,.72,.2,1) infinite; }
        .sl-profile-door-icon.is-looping.is-exit .sl-person { animation:slDoorPersonExitLoop 4.6s cubic-bezier(.2,.72,.2,1) infinite; }

        @keyframes slDoorEnterLeaf {
          0%,15%{transform:scaleX(1)} 31%,70%{transform:scaleX(.25)} 87%,100%{transform:scaleX(1)}
        }
        @keyframes slDoorPersonEnter {
          0%{transform:translateX(-2.8px) translateY(0) scale(1);opacity:1}
          14%{transform:translateX(-1.2px) translateY(-.25px) scale(1);opacity:1}
          34%{transform:translateX(2.1px) translateY(.15px) scale(.97);opacity:1}
          54%{transform:translateX(5.1px) translateY(-.18px) scale(.89);opacity:1}
          72%{transform:translateX(7.6px) translateY(0) scale(.76);opacity:.14}
          74%,100%{transform:translateX(7.6px) scale(.76);opacity:0}
        }
        @keyframes slDoorExitLeaf {
          0%,13%{transform:scaleX(1)} 28%,70%{transform:scaleX(.25)} 87%,100%{transform:scaleX(1)}
        }
        @keyframes slDoorPersonExit {
          0%,17%{transform:translateX(7.6px) scale(.76);opacity:0}
          27%{transform:translateX(6.7px) translateY(0) scale(.8);opacity:.35}
          43%{transform:translateX(4.1px) translateY(-.18px) scale(.88);opacity:1}
          63%{transform:translateX(1.3px) translateY(.15px) scale(.96);opacity:1}
          82%,100%{transform:translateX(-3px) translateY(0) scale(1);opacity:1}
        }
        @keyframes slDoorWaveEnter {
          0%,8%{transform:rotate(0deg)}
          13%{transform:rotate(-64deg)}
          20%{transform:rotate(-25deg)}
          27%{transform:rotate(-68deg)}
          34%{transform:rotate(-18deg)}
          42%,100%{transform:rotate(16deg)}
        }
        @keyframes slWalkArmFront { from{transform:rotate(-18deg)} to{transform:rotate(22deg)} }
        @keyframes slWalkArmBack { from{transform:rotate(20deg)} to{transform:rotate(-18deg)} }
        @keyframes slWalkLegFront { from{transform:rotate(-12deg)} to{transform:rotate(15deg)} }
        @keyframes slWalkLegBack { from{transform:rotate(13deg)} to{transform:rotate(-12deg)} }

        @keyframes slDoorEnterLeafLoop {
          0%,5%,34%,100%{transform:scaleX(1)} 11%,27%{transform:scaleX(.25)}
        }
        @keyframes slDoorPersonEnterLoop {
          0%,3%{transform:translateX(-2.8px) scale(1);opacity:1}
          15%{transform:translateX(2.2px) scale(.96);opacity:1}
          26%{transform:translateX(7.6px) scale(.76);opacity:0}
          27%,86%{transform:translateX(7.6px) scale(.76);opacity:0}
          87%{transform:translateX(-2.8px) scale(1);opacity:0}
          93%,100%{transform:translateX(-2.8px) scale(1);opacity:1}
        }
        @keyframes slDoorExitLeafLoop {
          0%,5%,34%,100%{transform:scaleX(1)} 11%,27%{transform:scaleX(.25)}
        }
        @keyframes slDoorPersonExitLoop {
          0%,8%{transform:translateX(7.6px) scale(.76);opacity:0}
          15%{opacity:.35}
          22%{transform:translateX(2.4px) scale(.94);opacity:1}
          31%{transform:translateX(-3px) scale(1);opacity:1}
          32%,86%{transform:translateX(-3px) scale(1);opacity:1}
          87%{opacity:0}
          93%,100%{transform:translateX(7.6px) scale(.76);opacity:0}
        }

        @media (prefers-reduced-motion:reduce) {
          .sl-profile-door-icon .sl-door-leaf,
          .sl-profile-door-icon .sl-person,
          .sl-profile-door-icon .sl-arm-front,
          .sl-profile-door-icon .sl-arm-back,
          .sl-profile-door-icon .sl-leg-front,
          .sl-profile-door-icon .sl-leg-back { animation:none !important; }
          .sl-profile-door-icon.is-enter .sl-person-facing { transform:scaleX(1) !important; }
          .sl-profile-door-icon.is-exit .sl-person-facing { transform:scaleX(-1) !important; }
        }
      `}</style>

      <path d="M11.2 3.5h8.1a1 1 0 0 1 1 1v15.9H10.2V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path className="sl-door-leaf" d="M12.2 4.7h6.7v14.5h-6.7V4.7Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <circle cx="17.2" cy="12" r=".72" fill="currentColor" />

      <g className="sl-person">
        <g className="sl-person-facing" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6.3" cy="6.85" r="1.82" />
          <path d="M7.95 6.6 9 7.05 7.95 7.5" />
          <path d="M6.05 8.75 6.2 14.65" />
          <g className="sl-arm-back"><path d="M5.75 10.25 3.55 13.1" /></g>
          <g className="sl-arm-front"><path d="M6.55 10.2 9.15 12.25" /></g>
          <g className="sl-leg-back"><path d="M6.05 14.55 4.8 19.7 4.15 21" /></g>
          <g className="sl-leg-front"><path d="M6.35 14.55 7.7 19.55 8.65 20.75" /></g>
        </g>
      </g>
    </svg>
  )
}
