(function () {
  const navEl = document.getElementById("nav");
  const articleEl = document.getElementById("article");
  const searchInput = document.getElementById("search");
  const searchResults = document.getElementById("search-results");

  function currentId() {
    const hash = (location.hash || "#rules").slice(1);
    return window.KB.pages[hash] ? hash : "rules";
  }

  function renderNav(activeId) {
    navEl.innerHTML = window.KB.nav
      .map(
        (item) =>
          `<li><a href="#${item.id}" class="${item.id === activeId ? "active" : ""}">${item.label}</a></li>`
      )
      .join("");
  }

  function pageIndex(id) {
    return window.KB.order.indexOf(id);
  }

  function renderArticle(id) {
    const page = window.KB.pages[id];
    if (!page) return;

    const idx = pageIndex(id);
    const prev = idx > 0 ? window.KB.order[idx - 1] : null;
    const next = idx < window.KB.order.length - 1 ? window.KB.order[idx + 1] : null;

    document.title = `${page.title} — БАЗА 1С`;

    articleEl.innerHTML = `
      <p class="eyebrow">${page.eyebrow}</p>
      <h1>${page.title}</h1>
      ${page.html}
      <div class="page-nav">
        <div>${prev ? `<a href="#${prev}">← ${window.KB.pages[prev].title}</a>` : ""}</div>
        <div>${next ? `<a href="#${next}">${window.KB.pages[next].title} →</a>` : ""}</div>
      </div>
    `;

    renderNav(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function plainText(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").replace(/\s+/g, " ").trim();
  }

  function runSearch(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      searchResults.classList.add("hidden");
      searchResults.innerHTML = "";
      return;
    }

    const hits = window.KB.nav
      .map((item) => {
        const page = window.KB.pages[item.id];
        const hay = `${page.title} ${page.eyebrow} ${plainText(page.html)}`.toLowerCase();
        return hay.includes(q) ? item : null;
      })
      .filter(Boolean);

    searchResults.classList.remove("hidden");
    if (!hits.length) {
      searchResults.innerHTML = `<h2>Поиск</h2><p style="color:var(--muted);font-size:0.9rem">Ничего не найдено</p>`;
      return;
    }

    searchResults.innerHTML = `
      <h2>Поиск</h2>
      <ul class="nav-list">
        ${hits.map((h) => `<li><a href="#${h.id}">${h.label}</a></li>`).join("")}
      </ul>
    `;
  }

  window.addEventListener("hashchange", () => renderArticle(currentId()));
  searchInput.addEventListener("input", () => runSearch(searchInput.value));

  renderArticle(currentId());
})();
