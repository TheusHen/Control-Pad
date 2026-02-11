import { AppController } from "./controller";

const controller = new AppController();

window.addEventListener("DOMContentLoaded", () => {
  void controller.bootstrap();
});
