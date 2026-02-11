import { AppController } from "./controller";

const controller = new AppController();

window.addEventListener("DOMContentLoaded", () => {
  void controller.bootstrap().catch((error) => {
    const app = document.querySelector<HTMLElement>("#app");
    if (app) {
      app.innerHTML = `<main style="padding:16px;font-family:Segoe UI, sans-serif;">
        <h2>Initialization Error</h2>
        <pre style="white-space:pre-wrap;">${String(error)}</pre>
      </main>`;
    }
  });
});
