const isBranchRootPages =
  window.location.hostname === "sierlia.github.io" &&
  window.location.pathname.startsWith("/testing3/");

const hasViteBundle = Array.from(document.scripts).some((script) =>
  /\/testing3\/assets\/index-[^/]+\.js(?:$|\?)/.test(script.src),
);

if (isBranchRootPages && !hasViteBundle) {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/testing3/assets/app.css";
  document.head.appendChild(stylesheet);

  const app = document.createElement("script");
  app.type = "module";
  app.src = "/testing3/assets/app.js";
  document.body.appendChild(app);
}
