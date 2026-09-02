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

    /* Mantém os cards compactos no telefone sem alterar o desktop. */
    @media (min-width:640px){
      .public-home a[data-sl-home-shortcut-card="true"]{padding-right:1.25rem!important}
    }
  `;
  document.head.appendChild(style);
  document.documentElement.dataset.motionBeta19RegressionFix = "true";
})();
