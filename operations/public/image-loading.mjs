/** Enhance image frames without delaying images or hiding page content. */
export function initImagePlaceholders(root = document) {
  root.querySelectorAll("[data-image-placeholder]").forEach((frame) => {
    const img = frame.querySelector("img");
    if (!img || frame.dataset.imageState) return;

    const finish = () => {
      img.removeEventListener("load", finish);
      img.removeEventListener("error", finish);
      frame.classList.remove("is-image-loading");
      frame.removeAttribute("aria-busy");
      const failed = img.naturalWidth === 0;
      frame.dataset.imageState = failed ? "error" : "ready";
      if (failed) {
        frame.classList.add("image-load-error");
        const message = document.createElement("span");
        message.className = "image-load-message";
        message.textContent = `Photo unavailable. ${img.alt}`;
        frame.append(message);
      }
    };

    // Register first so an image completing during setup cannot leave a skeleton behind.
    img.addEventListener("load", finish);
    img.addEventListener("error", finish);
    if (img.complete) {
      finish();
    } else {
      frame.dataset.imageState = "loading";
      frame.classList.add("is-image-loading");
      frame.setAttribute("aria-busy", "true");
    }
  });
}
