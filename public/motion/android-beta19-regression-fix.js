"use strict";

// Beta 19 — correção de regressões visuais sem tocar no runtime histórico de animações.
(() => {
  const ID = "sl-motion-beta19-regression-style";
  if (document.getElementById(ID)) return;

  const style = document.createElement("style");
  style.id = ID;
  style.textContent = `
    /* A Home React já possui exatamente quatro atalhos e seus ícones originais. */
    .public-home [data-sl-home-generated-fourth="true"]{display:none!important}
    .public-home .sl-home-runtime-icon{display:none!important}
    .public-home a[data-sl-home-shortcut-card="true"]{padding-right:.625rem!important}

    /* Compactação exclusiva do telefone: menos rolagem, mantendo leitura e toque confortáveis. */
    @media (max-width:639px){
      .public-home a[data-home-shortcut-id]{padding:.625rem!important;border-radius:.75rem!important}
      .public-home [data-original-home-icon="true"]{width:2rem!important;height:2rem!important;margin-bottom:.4rem!important}
      .public-home [data-original-home-icon="true"] svg{width:1rem!important;height:1rem!important}
      .public-home a[data-home-shortcut-id] h2{font-size:.875rem!important;line-height:1.05rem!important}
      .public-home a[data-home-shortcut-id] p{margin-top:.3rem!important;font-size:.59rem!important;line-height:.9rem!important}
      .public-home a[data-home-shortcut-id] h2 + p + span{margin-top:.4rem!important}
    }

    @media (min-width:640px){
      .public-home a[data-sl-home-shortcut-card="true"]{padding-right:1.25rem!important}
    }
  `;
  document.head.appendChild(style);
  document.documentElement.dataset.motionBeta19RegressionFix = "true";
})();
