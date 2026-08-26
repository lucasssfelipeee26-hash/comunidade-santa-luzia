"use client"

export function DoorTransitionScene({
  direction,
  active,
}: {
  direction: "enter" | "exit"
  active: boolean
}) {
  if (!active) return null

  return (
    <div
      className={`sl-door-scene sl-door-scene-${direction}`}
      role="status"
      aria-live="polite"
      aria-label={direction === "enter" ? "Entrando na área restrita" : "Saindo da área restrita"}
      data-door-scene={direction}
    >
      <style>{`
        .sl-door-scene{
          position:fixed;inset:0;z-index:99999;display:grid;place-items:center;
          background:radial-gradient(circle at 50% 38%,rgba(255,250,240,.97),rgba(249,239,224,.96) 48%,rgba(93,18,38,.13));
          backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);
          perspective:800px;pointer-events:all;overflow:hidden
        }
        .sl-door-scene::after{
          content:"";position:absolute;left:50%;bottom:17%;width:min(78vw,330px);height:34px;
          transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,rgba(60,34,26,.22),rgba(60,34,26,0) 70%);
          filter:blur(2px)
        }
        .sl-door-stage{position:relative;width:min(82vw,350px);height:min(68vh,470px);transform-style:preserve-3d}
        .sl-door-wall{
          position:absolute;left:50%;top:8%;width:58%;height:73%;transform:translateX(-8%);
          border:1px solid rgba(212,175,55,.28);border-radius:3px 3px 1px 1px;
          background:linear-gradient(90deg,#eee2d1 0 8%,#fff9ed 8% 82%,#e8dbc7 82% 100%);
          box-shadow:0 20px 45px rgba(75,28,38,.14),inset 12px 0 20px rgba(255,255,255,.55),inset -12px 0 18px rgba(105,66,44,.08)
        }
        .sl-door-frame{
          position:absolute;left:42%;top:18%;width:43%;height:60%;
          border:10px solid #6f172c;border-bottom-width:8px;border-radius:4px 4px 1px 1px;
          background:linear-gradient(135deg,#d4af37,#f1d77c 24%,#8e6a20 78%,#c99b28);
          box-shadow:9px 8px 18px rgba(45,20,23,.27),inset 0 0 0 2px rgba(255,248,218,.55)
        }
        .sl-door-depth{
          position:absolute;inset:8px;background:linear-gradient(100deg,#220a11 0%,#45101e 50%,#18070c 100%);
          box-shadow:inset 18px 0 20px rgba(0,0,0,.45),inset -8px 0 16px rgba(212,175,55,.12)
        }
        .sl-door-leaf3d{
          position:absolute;left:8px;top:8px;bottom:8px;width:86%;transform-origin:100% 50%;
          background:linear-gradient(90deg,#7a1830,#a52946 45%,#681126 100%);
          border:2px solid #d4af37;box-shadow:inset 8px 0 12px rgba(255,255,255,.08),0 5px 12px rgba(0,0,0,.25)
        }
        .sl-door-leaf3d::before,.sl-door-leaf3d::after{content:"";position:absolute;left:14%;right:14%;border:1px solid rgba(241,215,124,.48);border-radius:2px}
        .sl-door-leaf3d::before{top:12%;height:29%}.sl-door-leaf3d::after{bottom:12%;height:33%}
        .sl-door-knob{position:absolute;right:10%;top:50%;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fff4b5,#d4af37 45%,#76520d);box-shadow:0 1px 3px rgba(0,0,0,.35)}

        .sl-door-person{
          position:absolute;left:17%;bottom:17%;width:42%;height:57%;transform-origin:50% 100%;transform-style:preserve-3d;
          filter:drop-shadow(0 9px 7px rgba(43,24,22,.24))
        }
        .sl-head{position:absolute;left:36%;top:0;width:28%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 32% 24%,#665d5c,#393334 57%,#211d1e);box-shadow:inset -5px -5px 8px rgba(0,0,0,.23)}
        .sl-neck{position:absolute;left:45%;top:20%;width:10%;height:8%;border-radius:4px;background:#403839}
        .sl-torso{position:absolute;left:25%;top:24%;width:50%;height:35%;border-radius:18% 18% 10% 10%;background:linear-gradient(90deg,#691226,#971f3b 42%,#7c172e 68%,#58101f);box-shadow:inset 6px 0 9px rgba(255,255,255,.08),inset -6px 0 9px rgba(0,0,0,.16)}
        .sl-torso::after{content:"";position:absolute;left:15%;right:15%;bottom:7%;height:5px;border-radius:4px;background:linear-gradient(90deg,#9d7722,#e3c45f,#9d7722);opacity:.95}
        .sl-arm{position:absolute;top:28%;width:12%;height:34%;border-radius:999px;background:linear-gradient(90deg,#343031,#51494a 50%,#2c292a);transform-origin:50% 8%}
        .sl-arm-l{left:16%}.sl-arm-r{right:16%}
        .sl-hand{position:absolute;left:17%;bottom:-7%;width:66%;height:15%;border-radius:50%;background:#40393a}
        .sl-hips{position:absolute;left:28%;top:56%;width:44%;height:14%;border-radius:10px;background:linear-gradient(90deg,#4b3340,#6d4356 48%,#472d39)}
        .sl-leg{position:absolute;top:65%;width:17%;height:34%;border-radius:999px;background:linear-gradient(90deg,#3a2d36,#68465b 47%,#372934);transform-origin:50% 3%}
        .sl-leg-l{left:31%}.sl-leg-r{right:31%}
        .sl-shoe{position:absolute;bottom:-4%;width:150%;height:16%;border-radius:55% 55% 30% 30%;background:#2b2527}.sl-leg-l .sl-shoe{right:0}.sl-leg-r .sl-shoe{left:0}
        .sl-chest-mark{display:none;position:absolute;left:42%;top:31%;width:16%;height:11%;border-radius:50%;border:2px solid rgba(212,175,55,.82)}
        .sl-door-scene-exit .sl-chest-mark{display:block}

        .sl-door-scene-enter .sl-door-person{animation:slSceneEnter 2.15s cubic-bezier(.2,.62,.18,1) both}
        .sl-door-scene-enter .sl-door-leaf3d{animation:slSceneDoorEnter 2.15s cubic-bezier(.2,.62,.18,1) both}
        .sl-door-scene-enter .sl-arm-l{animation:slEnterWave .31s ease-in-out 4 alternate}
        .sl-door-scene-enter .sl-arm-r{animation:slWalkArmR .32s ease-in-out 5 alternate}
        .sl-door-scene-enter .sl-leg-l{animation:slWalkLegL .32s ease-in-out 5 alternate}
        .sl-door-scene-enter .sl-leg-r{animation:slWalkLegR .32s ease-in-out 5 alternate}

        .sl-door-scene-exit .sl-door-person{left:43%;bottom:24%;transform:scale(.56);animation:slSceneExit 2.15s cubic-bezier(.2,.62,.18,1) both}
        .sl-door-scene-exit .sl-door-leaf3d{animation:slSceneDoorExit 2.15s cubic-bezier(.2,.62,.18,1) both}
        .sl-door-scene-exit .sl-arm-l{animation:slWalkArmL .32s ease-in-out 5 alternate}
        .sl-door-scene-exit .sl-arm-r{animation:slWalkArmR .32s ease-in-out 5 alternate}
        .sl-door-scene-exit .sl-leg-l{animation:slWalkLegL .32s ease-in-out 5 alternate}
        .sl-door-scene-exit .sl-leg-r{animation:slWalkLegR .32s ease-in-out 5 alternate}
        .sl-door-scene-exit .sl-torso{background:linear-gradient(90deg,#5b1021,#8a1c35 45%,#6b1229)}

        @keyframes slSceneDoorEnter{0%,8%{transform:perspective(280px) rotateY(0)}25%,76%{transform:perspective(280px) rotateY(-68deg)}92%,100%{transform:perspective(280px) rotateY(0)}}
        @keyframes slSceneDoorExit{0%,8%{transform:perspective(280px) rotateY(0)}24%,76%{transform:perspective(280px) rotateY(-68deg)}92%,100%{transform:perspective(280px) rotateY(0)}}
        @keyframes slSceneEnter{
          0%{transform:translate3d(0,0,70px) scale(1);opacity:1}
          24%{transform:translate3d(20px,-1px,45px) scale(.93);opacity:1}
          48%{transform:translate3d(58px,-8px,12px) scale(.78);opacity:1}
          70%{transform:translate3d(96px,-21px,-25px) scale(.58);opacity:.98}
          84%{transform:translate3d(112px,-31px,-50px) scale(.46);opacity:.22}
          88%,100%{transform:translate3d(116px,-34px,-60px) scale(.42);opacity:0}
        }
        @keyframes slSceneExit{
          0%,10%{transform:translate3d(0,-10px,-50px) scale(.48) rotateY(180deg);opacity:0}
          22%{transform:translate3d(-8px,-7px,-35px) scale(.54) rotateY(180deg);opacity:.85}
          46%{transform:translate3d(-48px,-2px,0) scale(.7) rotateY(180deg);opacity:1}
          72%{transform:translate3d(-92px,4px,40px) scale(.9) rotateY(180deg);opacity:1}
          100%{transform:translate3d(-126px,8px,75px) scale(1.05) rotateY(180deg);opacity:1}
        }
        @keyframes slEnterWave{from{transform:rotate(7deg)}to{transform:rotate(62deg)}}
        @keyframes slWalkArmL{from{transform:rotate(-15deg)}to{transform:rotate(18deg)}}
        @keyframes slWalkArmR{from{transform:rotate(17deg)}to{transform:rotate(-16deg)}}
        @keyframes slWalkLegL{from{transform:rotate(-13deg)}to{transform:rotate(15deg)}}
        @keyframes slWalkLegR{from{transform:rotate(14deg)}to{transform:rotate(-14deg)}}

        .sl-door-caption{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);font:700 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6f172c;white-space:nowrap}
        .sl-door-caption::after{content:"";display:block;width:42%;height:2px;margin:7px auto 0;border-radius:3px;background:#d4af37}

        @media(prefers-reduced-motion:reduce){.sl-door-person,.sl-door-leaf3d,.sl-arm,.sl-leg{animation-duration:.35s!important;animation-iteration-count:1!important}}
      `}</style>

      <div className="sl-door-stage">
        <div className="sl-door-wall" />
        <div className="sl-door-frame">
          <div className="sl-door-depth" />
          <div className="sl-door-leaf3d"><span className="sl-door-knob" /></div>
        </div>

        <div className="sl-door-person" aria-hidden="true">
          <div className="sl-head" />
          <div className="sl-neck" />
          <div className="sl-torso" />
          <div className="sl-chest-mark" />
          <div className="sl-arm sl-arm-l"><span className="sl-hand" /></div>
          <div className="sl-arm sl-arm-r"><span className="sl-hand" /></div>
          <div className="sl-hips" />
          <div className="sl-leg sl-leg-l"><span className="sl-shoe" /></div>
          <div className="sl-leg sl-leg-r"><span className="sl-shoe" /></div>
        </div>

        <div className="sl-door-caption">{direction === "enter" ? "Entrando" : "Saindo"}</div>
      </div>
    </div>
  )
}
