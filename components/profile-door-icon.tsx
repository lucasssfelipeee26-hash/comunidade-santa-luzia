export function ProfileDoorIcon({
  className = "size-6",
  animated = true,
  loop = true,
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
        .sl-profile-door-icon { overflow: visible; }
        .sl-profile-door-icon .sl-door-leaf,
        .sl-profile-door-icon .sl-person { transform-box: fill-box; will-change: transform, opacity; }
        .sl-profile-door-icon .sl-door-leaf { transform-origin: 100% 50%; }
        .sl-profile-door-icon .sl-person { transform-origin: center; }
        .sl-profile-door-icon.is-animated.is-enter .sl-door-leaf { animation: slDoorEnterLeaf 1.55s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-enter .sl-person { animation: slDoorPersonEnter 1.55s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-exit .sl-door-leaf { animation: slDoorExitLeaf 1.55s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-animated.is-exit .sl-person { animation: slDoorPersonExit 1.55s cubic-bezier(.2,.72,.2,1) both; }
        .sl-profile-door-icon.is-looping.is-enter .sl-door-leaf { animation: slDoorEnterLeafLoop 3.8s cubic-bezier(.2,.72,.2,1) infinite; }
        .sl-profile-door-icon.is-looping.is-enter .sl-person { animation: slDoorPersonEnterLoop 3.8s cubic-bezier(.2,.72,.2,1) infinite; }
        .sl-profile-door-icon.is-looping.is-exit .sl-door-leaf { animation: slDoorExitLeafLoop 3.8s cubic-bezier(.2,.72,.2,1) infinite; }
        .sl-profile-door-icon.is-looping.is-exit .sl-person { animation: slDoorPersonExitLoop 3.8s cubic-bezier(.2,.72,.2,1) infinite; }
        @keyframes slDoorEnterLeaf {
          0%,14%{transform:scaleX(1)} 32%,66%{transform:scaleX(.28)} 84%,100%{transform:scaleX(1)}
        }
        @keyframes slDoorPersonEnter {
          0%,10%{transform:translateX(-2.4px) scale(1);opacity:1} 42%{transform:translateX(3px) scale(.94);opacity:1} 66%{transform:translateX(7px) scale(.78);opacity:.08} 68%,100%{transform:translateX(7px) scale(.78);opacity:0}
        }
        @keyframes slDoorExitLeaf {
          0%,14%{transform:scaleX(1)} 32%,66%{transform:scaleX(.28)} 84%,100%{transform:scaleX(1)}
        }
        @keyframes slDoorPersonExit {
          0%,24%{transform:translateX(7px) scale(.78);opacity:0} 34%{opacity:.2} 52%{transform:translateX(2px) scale(.94);opacity:1} 78%,100%{transform:translateX(-3.2px) scale(1);opacity:1}
        }
        @keyframes slDoorEnterLeafLoop {
          0%,6%,35%,100%{transform:scaleX(1)} 12%,25%{transform:scaleX(.28)}
        }
        @keyframes slDoorPersonEnterLoop {
          0%,4%{transform:translateX(-2.4px) scale(1);opacity:1} 16%{transform:translateX(3px) scale(.94);opacity:1} 25%{transform:translateX(7px) scale(.78);opacity:0} 26%,84%{transform:translateX(7px) scale(.78);opacity:0} 85%{transform:translateX(-2.4px) scale(1);opacity:0} 91%,100%{transform:translateX(-2.4px) scale(1);opacity:1}
        }
        @keyframes slDoorExitLeafLoop {
          0%,6%,35%,100%{transform:scaleX(1)} 12%,25%{transform:scaleX(.28)}
        }
        @keyframes slDoorPersonExitLoop {
          0%,8%{transform:translateX(7px) scale(.78);opacity:0} 14%{opacity:.25} 20%{transform:translateX(2px) scale(.94);opacity:1} 31%{transform:translateX(-3.2px) scale(1);opacity:1} 32%,84%{transform:translateX(-3.2px) scale(1);opacity:1} 85%{opacity:0} 90%,100%{transform:translateX(7px) scale(.78);opacity:0}
        }
        @media (prefers-reduced-motion: reduce) {
          .sl-profile-door-icon .sl-door-leaf,
          .sl-profile-door-icon .sl-person { animation:none !important; transform:none !important; opacity:1 !important; }
        }
      `}</style>

      <path d="M11.2 3.5h8.1a1 1 0 0 1 1 1v15.9H10.2V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path className="sl-door-leaf" d="M12.2 4.7h6.7v14.5h-6.7V4.7Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <circle cx="17.2" cy="12" r=".72" fill="currentColor" />
      <g className="sl-person" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.35" cy="7.15" r="2.05" />
        <path d="M3.55 18.7c.2-4.05.7-6.65 1.65-8.2.42-.68 1.08-1.08 1.76-1.08.7 0 1.36.4 1.78 1.08.8 1.3 1.28 3.23 1.55 6.06" />
        <path d="M5.05 12.35 2.9 14.7M8.45 12.35l2.15 2.15" />
        <path d="M5.45 18.7 4.6 21M8.15 18.7 9 21" />
      </g>
    </svg>
  )
}
