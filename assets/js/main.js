(function () {
  const data = window.profileData;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const publicationState = {
    filter: "all",
    year: "all",
    query: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const placeholderUrl = (url) => !url || url === "#" || /^\[.*\]$/.test(url);

  function renderInlineLinks(value) {
    const text = String(value ?? "");
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let rendered = "";
    let lastIndex = 0;

    for (const match of text.matchAll(linkPattern)) {
      rendered += escapeHtml(text.slice(lastIndex, match.index));
      rendered += `<a href="${escapeHtml(match[2])}" target="_blank" rel="noreferrer">${escapeHtml(match[1])}</a>`;
      lastIndex = match.index + match[0].length;
    }

    rendered += escapeHtml(text.slice(lastIndex));
    return rendered;
  }

  function highlightPeopleCounts(value) {
    return value.replace(
      /\b(\d+)\s+(students?|people|recipients?|awardees?|candidates?|undergraduates?|graduates?)(\s+(?:annually|each year|per year|nationwide))?/gi,
      '<mark class="award-count-highlight"><strong>$1</strong> $2$3</mark>'
    );
  }

  function renderAwardNote(value) {
    const text = String(value ?? "");
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let rendered = "";
    let lastIndex = 0;

    for (const match of text.matchAll(linkPattern)) {
      rendered += highlightPeopleCounts(escapeHtml(text.slice(lastIndex, match.index)));
      rendered += `<a href="${escapeHtml(match[2])}" target="_blank" rel="noreferrer">${escapeHtml(match[1])}</a>`;
      lastIndex = match.index + match[0].length;
    }

    rendered += highlightPeopleCounts(escapeHtml(text.slice(lastIndex)));
    return rendered;
  }

  function setField(name, value) {
    $$(`[data-field="${name}"]`).forEach((node) => {
      node.textContent = value ?? "";
    });
  }

  function labelClass(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function selfHighlightTargets(publication) {
    return [publication.highlightAuthor, data.personal.name, "付鹏翔", "Pengxiang Fu"]
      .filter(Boolean)
      .filter((target, index, targets) => targets.indexOf(target) === index);
  }

  function highlightSelf(value, publication) {
    let rendered = escapeHtml(value);
    selfHighlightTargets(publication).forEach((target) => {
      rendered = rendered.replace(
        new RegExp(escapeRegExp(escapeHtml(target)), "g"),
        `<strong class="author-self">${escapeHtml(target)}</strong>`
      );
    });
    return rendered;
  }

  function renderBasics() {
    const { personal, hero } = data;
    document.title = `${personal.name} | Academic Homepage`;
    setField("name", personal.name);
    setField("englishName", personal.englishName);
    setField("shortName", personal.shortName || personal.name);
    setField("footerName", personal.name);
    setField("initials", personal.initials);
    setField("roleLine", `${personal.role} | ${personal.affiliation}`);
    setField("heroSummary", hero.summary);
    setField("focusTitle", hero.focusTitle);
    setField("focusText", hero.focusText);
    setField("snapshotTitle", data.snapshot.title);
    setField("snapshotIntro", data.snapshot.intro);
    setField("contactIntro", data.contactIntro);
    setField("collabTitle", data.collaboration.title);
    setField("collabText", data.collaboration.text);
    setField("footerNote", data.footerNote);
    document.querySelector('meta[property="og:title"]').setAttribute("content", `${personal.name} | Academic Homepage`);

    const portraitImage = $("[data-portrait-img]");
    if (personal.photoUrl && !placeholderUrl(personal.photoUrl)) {
      portraitImage.src = personal.photoUrl;
      portraitImage.alt = personal.photoAlt || `${personal.name} portrait photo`;
      portraitImage.hidden = false;
      $(".portrait-shell").classList.add("has-photo");
    } else {
      portraitImage.removeAttribute("src");
      portraitImage.hidden = true;
      $(".portrait-shell").classList.remove("has-photo");
    }

    const cvLink = $("[data-cv-link]");
    cvLink.href = personal.cvUrl || "#";
    if (placeholderUrl(personal.cvUrl)) {
      cvLink.dataset.placeholder = "true";
      cvLink.setAttribute("aria-label", "CV link placeholder. Replace cvUrl in data.js.");
    } else {
      cvLink.setAttribute("download", "");
    }

    $("[data-keywords]").innerHTML = hero.keywords
      .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
      .join("");

    $("[data-profile-facts]").innerHTML = hero.facts
      .map(
        (fact) => `
          <div>
            <dt>${escapeHtml(fact.label)}</dt>
            <dd>${escapeHtml(fact.value)}</dd>
          </div>
        `
      )
      .join("");

    $("[data-collab-points]").innerHTML = data.collaboration.points
      .map((point) => `<li>${escapeHtml(point)}</li>`)
      .join("");

    const schema = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: personal.name,
      alternateName: personal.englishName,
      affiliation: personal.affiliation,
      email: placeholderUrl(personal.email) ? undefined : personal.email,
      url: window.location.origin + window.location.pathname,
      sameAs: [personal.github, personal.googleScholar, personal.orcid, personal.researchGate, personal.linkedin].filter(
        (url) => !placeholderUrl(url)
      ),
      knowsAbout: data.interests.map((interest) => interest.title),
      mainEntityOfPage: window.location.href.split("#")[0]
    };
    $("[data-schema-org]").textContent = JSON.stringify(schema, null, 2);
  }

  function renderAbout() {
    const about = data.about;
    $("[data-about]").innerHTML = `
      <div class="about-copy">
        ${about.paragraphs.map((paragraph) => `<p>${renderInlineLinks(paragraph)}</p>`).join("")}
      </div>
      <blockquote>${escapeHtml(about.motto)}</blockquote>
    `;
  }

  function renderSnapshot() {
    $("[data-snapshot]").innerHTML = data.snapshot.items
      .map(
        (item, index) => `
          <article class="snapshot-item" style="--index: ${index}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <p>${escapeHtml(item.detail)}</p>
          </article>
        `
      )
      .join("");
  }

  function renderEducation() {
    $("[data-education]").innerHTML = data.education
      .map((item) => {
        const details = Array.isArray(item.details) ? item.details.filter(Boolean) : [];

        return `
          <article class="timeline-item">
            <div class="timeline-date">${escapeHtml(item.period)}</div>
            <div class="timeline-card">
              <div class="education-head">
                ${
                  item.logoUrl
                    ? `<img class="education-logo" src="${escapeHtml(item.logoUrl)}" alt="${escapeHtml(
                        item.logoAlt || `${item.school} emblem`
                      )}" loading="lazy" />`
                    : ""
                }
                <div>
                  <h3>${escapeHtml(item.degree)}</h3>
                  <p class="meta">${escapeHtml(item.school)} | ${escapeHtml(item.unit)}</p>
                </div>
              </div>
              <p>${escapeHtml(item.major)}</p>
              ${item.advisor ? `<p class="advisor">Advisor: ${escapeHtml(item.advisor)}</p>` : ""}
              ${details.length ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderInterests() {
    $("[data-interests]").innerHTML = data.interests
      .map(
        (interest, index) => `
          <article class="interest-card" style="--delay: ${index * 60}ms">
            <span class="interest-index">${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(interest.title)}</h3>
            <p>${escapeHtml(interest.description)}</p>
            <div class="mini-tags">
              ${interest.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderPublicationFilters() {
    const filterBar = $("[data-publication-filters]");
    const configuredFilters = data.publicationFilters || [];

    filterBar.innerHTML = configuredFilters
      .map(
        (filter, index) => `
          <button class="filter-btn ${index === 0 ? "is-active" : ""}" type="button" data-filter="${escapeHtml(
            filter.value
          )}">
            ${escapeHtml(filter.label)}
          </button>
        `
      )
      .join("");

    const yearSelect = $("[data-publication-year]");
    const years = [...new Set(data.publications.map((publication) => publication.year))]
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a));
    yearSelect.innerHTML = [
      '<option value="all">All years</option>',
      ...years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)
    ].join("");
  }

  function publicationMatches(publication, filter, year) {
    if (filter === "all") return true;
    if (filter === "featured") return publication.featured;
    return publication.type === filter || publication.category === filter;
  }

  function publicationMatchesYear(publication, year) {
    return year === "all" || publication.year === year;
  }

  function publicationMatchesSearch(publication, query) {
    if (!query) return true;
    const searchableText = [
      publication.title,
      publication.authors,
      publication.venue,
      publication.year,
      publication.category,
      publication.type,
      publication.typeLabel,
      publication.status,
      publication.statusGroup,
      publication.authorNote,
      publication.summary,
      ...(publication.meta || []),
      ...(publication.details || []).flatMap((detail) => [detail.label, detail.value]),
      ...(publication.links ? Object.keys(publication.links) : [])
    ]
      .join(" ")
      .toLowerCase();

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => searchableText.includes(term));
  }

  function isUnacceptedPublication(publication) {
    return ["under-review", "submitted", "in-preparation", "in-progress", "preprint", "filed"].includes(
      publication.statusGroup
    );
  }

  function outputCategoryLabel(publication) {
    if (publication.categoryLabel) return publication.categoryLabel;
    const labels = {
      paper: "Paper",
      project: "Project",
      patent: "Patent",
      software: "Software"
    };
    return labels[publication.category] || labels[publication.type] || publication.type || "Output";
  }

  function outputTypeLabel(publication) {
    return publication.typeLabel || outputCategoryLabel(publication);
  }

  function renderAuthors(publication) {
    return highlightSelf(publication.authors, publication);
  }

  function renderOutputDetails(publication) {
    if (!publication.details?.length) return "";
    return `
      <dl class="output-details">
        ${publication.details
          .map(
            (detail) => `
              <div>
                <dt>${escapeHtml(detail.label)}</dt>
                <dd>${highlightSelf(detail.value, publication)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    `;
  }

  function renderOutputMeta(publication) {
    if (!publication.meta?.length) return "";
    return `
      <div class="output-meta">
        ${publication.meta.map((item) => `<span>${highlightSelf(item, publication)}</span>`).join("")}
      </div>
    `;
  }

  function renderPublicationCard(publication) {
    return `
      <article class="publication-card" data-type="${escapeHtml(publication.type)}" data-publication-index="${publication.originalIndex}">
        <div class="publication-year">
          <strong>${escapeHtml(publication.year)}</strong>
          <span>${escapeHtml(outputCategoryLabel(publication))}</span>
        </div>
        <div class="publication-body">
          <div class="publication-topline">
            <span class="status-pill ${labelClass(publication.type)}">${escapeHtml(publication.status)}</span>
            <span class="type-pill">${escapeHtml(outputTypeLabel(publication))}</span>
          </div>
          <h3>${escapeHtml(publication.title)}</h3>
          <p class="authors">${renderAuthors(publication)}${
            publication.authorNote ? ` <span class="author-note">${escapeHtml(publication.authorNote)}</span>` : ""
          }</p>
          <p class="venue">${escapeHtml(publication.venue)}</p>
          ${renderOutputMeta(publication)}
          <p class="publication-summary">${escapeHtml(publication.summary)}</p>
          ${renderOutputDetails(publication)}
          ${
            publication.image?.src
              ? `
                <figure class="publication-figure">
                  <img src="${escapeHtml(publication.image.src)}" alt="${escapeHtml(publication.image.alt || publication.title)}" loading="lazy" />
                  ${publication.image.caption ? `<figcaption>${escapeHtml(publication.image.caption)}</figcaption>` : ""}
                </figure>
              `
              : ""
          }
          <div class="paper-links">
            ${Object.entries(publication.links || {})
              .filter(([, url]) => !placeholderUrl(url))
              .map(
                ([label, url]) => `
                  <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>
                `
              )
              .join("")}
            ${
              publication.bibtex
                ? `<button class="paper-action" type="button" data-bibtex-toggle="${publication.originalIndex}" aria-expanded="false">BibTeX</button>`
                : ""
            }
          </div>
          ${
            publication.bibtex
              ? `
                <div class="bibtex-panel" id="bibtex-${publication.originalIndex}" hidden>
                  <pre>${escapeHtml(publication.bibtex)}</pre>
                  <button class="copy-bibtex" type="button" data-bibtex-copy="${publication.originalIndex}">Copy BibTeX</button>
                </div>
              `
              : ""
          }
        </div>
      </article>
    `;
  }

  function renderPublicationList(target, publications, emptyText) {
    target.innerHTML = publications.length
      ? publications.map(renderPublicationCard).join("")
      : `
        <div class="empty-state">
          <strong>No matching outputs</strong>
          <span>${escapeHtml(emptyText)}</span>
        </div>
      `;
  }

  function renderPublications(
    filter = publicationState.filter,
    year = publicationState.year,
    query = publicationState.query
  ) {
    const publications = data.publications
      .map((publication, index) => ({ ...publication, originalIndex: index }))
      .filter((publication) => publicationMatches(publication, filter, year))
      .filter((publication) => publicationMatchesYear(publication, year))
      .filter((publication) => publicationMatchesSearch(publication, query));
    const acceptedPublications = publications.filter((publication) => !isUnacceptedPublication(publication));
    const unacceptedPublications = publications.filter(isUnacceptedPublication);

    const count = $("[data-publication-count]");
    if (count) {
      count.textContent = `Showing ${publications.length} of ${data.publications.length} outputs`;
    }

    renderPublicationList(
      $("[data-publications]"),
      acceptedPublications,
      "Try another keyword, type, or year."
    );
    renderPublicationList(
      $("[data-unaccepted-publications]"),
      unacceptedPublications,
      "No under-review or in-progress outputs are listed yet."
    );
  }

  function updatePublicationView() {
    renderPublications(publicationState.filter, publicationState.year, publicationState.query);
    setupPlaceholderLinks();
    setupReveal();
  }

  function renderHonors() {
    const list = $("[data-honors]");
    const expanded = list.dataset.expanded === "true";
    const visibleHonors = expanded ? data.honors : data.honors.slice(0, 3);

    list.innerHTML = visibleHonors
      .map(
        (award) => `
          <article class="award-item">
            <time>${escapeHtml(award.year)}</time>
            <div>
              <h3>${escapeHtml(award.title)}</h3>
              <p>${renderInlineLinks(award.organization)}</p>
              <span>${renderAwardNote(award.note)}</span>
            </div>
          </article>
        `
      )
      .join("");

    const toggle = $("[data-honors-toggle]");
    toggle.hidden = data.honors.length <= 3;
    toggle.textContent = expanded ? "Show fewer honors" : `Show all honors (${data.honors.length})`;
    toggle.setAttribute("aria-expanded", String(expanded));
  }

  function renderNews() {
    const list = $("[data-news]");
    const expanded = list.dataset.expanded === "true";
    const visibleNews = expanded ? data.news : data.news.slice(0, 3);
    list.innerHTML = visibleNews
      .map(
        (item) => `
          <article class="news-item">
            <time>${escapeHtml(item.date)}</time>
            <div>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.text)}</p>
            </div>
          </article>
        `
      )
      .join("");

    const toggle = $("[data-news-toggle]");
    toggle.hidden = data.news.length <= 3;
    toggle.textContent = expanded ? "Show Less" : "Show More";
  }

  function renderService() {
    $("[data-service]").innerHTML = data.services
      .map(
        (service) => `
          <article class="service-group">
            <h3>${escapeHtml(service.group)}</h3>
            <ul>
              ${service.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
        `
      )
      .join("");
  }

  function contactIcon(name) {
    const icons = {
      mail:
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
      github:
        '<svg class="brand-github" viewBox="0 0 24 24" focusable="false"><path d="M12 2.8a9.2 9.2 0 0 0-2.9 17.9c.46.08.63-.2.63-.45v-1.6c-2.56.56-3.1-1.1-3.1-1.1-.42-1.08-1.03-1.37-1.03-1.37-.84-.58.06-.57.06-.57.93.07 1.42.96 1.42.96.83 1.41 2.17 1 2.7.76.08-.6.32-1 .58-1.23-2.04-.23-4.19-1.02-4.19-4.55 0-1 .36-1.83.95-2.48-.1-.23-.41-1.17.09-2.44 0 0 .78-.25 2.53.94A8.8 8.8 0 0 1 12 7.25c.78 0 1.55.1 2.28.3 1.75-1.19 2.52-.94 2.52-.94.5 1.27.19 2.21.09 2.44.6.65.95 1.48.95 2.48 0 3.54-2.15 4.31-4.2 4.54.33.29.63.86.63 1.73v2.45c0 .25.16.54.64.45A9.2 9.2 0 0 0 12 2.8Z"/></svg>',
      scholar:
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z"/><path d="M7 11v4.4c0 1.3 2.24 2.6 5 2.6s5-1.3 5-2.6V11"/><path d="M20 9v5"/></svg>',
      file:
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/><path d="M9 13h6M9 17h6"/></svg>'
    };

    return icons[name] || icons.file;
  }

  function renderContact() {
    const { personal } = data;
    const emailIsPlaceholder = !personal.email || /^\[.*\]$/.test(personal.email);
    const contacts = [
      { label: "Email", value: personal.email, action: "Send", href: emailIsPlaceholder ? "#" : `mailto:${personal.email}`, icon: "mail" },
      { label: "GitHub", value: "PengxiangFu2003", action: "Code", href: personal.github, icon: "github" },
      { label: "Google Scholar", value: "Scholar profile", action: "Papers", href: personal.googleScholar, icon: "scholar" },
      { label: "ORCID", value: personal.orcid, href: personal.orcid, hidden: true },
      { label: "ResearchGate", value: personal.researchGate, href: personal.researchGate, hidden: true },
      { label: "LinkedIn", value: personal.linkedin, href: personal.linkedin, hidden: true },
      { label: "CV", value: "Curriculum vitae", action: "PDF", href: personal.cvUrl, icon: "file" }
    ];

    $("[data-contact-links]").innerHTML = contacts
      .filter((contact) => !contact.hidden)
      .map(
        (contact) => `
          <a class="contact-link" href="${escapeHtml(contact.href || "#")}" ${
          placeholderUrl(contact.href) ? 'data-placeholder="true"' : 'target="_blank" rel="noreferrer"'
        }>
            <span class="contact-icon" aria-hidden="true">${contactIcon(contact.icon)}</span>
            <span>${escapeHtml(contact.label)}</span>
            <strong>${escapeHtml(contact.value)}</strong>
            <em>${escapeHtml(contact.action || "Open")}</em>
          </a>
        `
      )
      .join("");
  }

  function setupNavigation() {
    const navToggle = $(".nav-toggle");
    const navLinks = $("[data-nav-links]");
    const header = $("[data-header]");

    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("nav-open", isOpen);
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("nav-open");
      }
    });

    const sections = $$("main section[id]");
    const links = $$(".nav-links a");
    const activeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const activeLink = links.find((link) => link.getAttribute("href") === `#${entry.target.id}`);
          links.forEach((link) => link.classList.remove("is-active"));
          if (activeLink) activeLink.classList.add("is-active");
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
    );
    sections.forEach((section) => activeObserver.observe(section));

    window.addEventListener("scroll", () => {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    });
  }

  function setupReveal() {
    const revealItems = $$(
      ".reveal, .interest-card, .publication-card"
    );
    if (prefersReducedMotion) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    revealItems.forEach((item) => observer.observe(item));
  }

  function setupPublicationFilters() {
    const filterBar = $("[data-publication-filters]");
    filterBar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      $$(".filter-btn", filterBar).forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      publicationState.filter = button.dataset.filter;
      updatePublicationView();
    });
  }

  function setupPublicationYearFilter() {
    const select = $("[data-publication-year]");
    if (!select) return;

    select.addEventListener("change", () => {
      publicationState.year = select.value;
      updatePublicationView();
    });
  }

  function setupPublicationSearch() {
    const input = $("[data-publication-search]");
    if (!input) return;

    input.addEventListener("input", () => {
      publicationState.query = input.value.trim();
      updatePublicationView();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !input.value) return;
      input.value = "";
      publicationState.query = "";
      updatePublicationView();
    });
  }

  function setupBibtexActions() {
    const publicationArea = $("[data-publications]").closest(".publication-sections");
    publicationArea.addEventListener("click", async (event) => {
      const toggle = event.target.closest("[data-bibtex-toggle]");
      const copyButton = event.target.closest("[data-bibtex-copy]");

      if (toggle) {
        const panel = $(`#bibtex-${toggle.dataset.bibtexToggle}`);
        if (!panel) return;
        const isOpen = !panel.hidden;
        panel.hidden = isOpen;
        toggle.setAttribute("aria-expanded", String(!isOpen));
        toggle.textContent = isOpen ? "BibTeX" : "Hide BibTeX";
        return;
      }

      if (copyButton) {
        const publication = data.publications[Number(copyButton.dataset.bibtexCopy)];
        if (!publication?.bibtex) return;
        try {
          await navigator.clipboard.writeText(publication.bibtex);
          showToast("BibTeX copied to clipboard.");
        } catch {
          showToast("BibTeX is visible above. Select and copy it manually.");
        }
      }
    });
  }

  function setupNewsToggle() {
    const toggle = $("[data-news-toggle]");
    const list = $("[data-news]");
    toggle.addEventListener("click", () => {
      list.dataset.expanded = list.dataset.expanded === "true" ? "false" : "true";
      renderNews();
      setupReveal();
    });
  }

  function setupHonorsToggle() {
    const toggle = $("[data-honors-toggle]");
    const list = $("[data-honors]");
    toggle.addEventListener("click", () => {
      list.dataset.expanded = list.dataset.expanded === "true" ? "false" : "true";
      renderHonors();
      setupReveal();
    });
  }

  function setupTheme() {
    const buttons = $$("[data-theme-toggle], [data-theme-toggle-mobile]");
    if (!buttons.length) return;
    const themeStorageKey = "academic-homepage-theme-v2";
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    const initialTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "dark";
    const themeColor = document.querySelector('meta[name="theme-color"]');

    const applyTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      buttons.forEach((button) => {
        const nextLabel = theme === "dark" ? "light" : "dark";
        const icon = button.querySelector("span");
        const label = button.querySelector("strong");
        if (icon) icon.textContent = theme === "dark" ? "\u2600" : "\u263E";
        if (label) label.textContent = theme === "dark" ? "Light theme" : "Dark theme";
        button.setAttribute("aria-label", `Switch to ${nextLabel} theme`);
      });
      themeColor?.setAttribute("content", theme === "dark" ? "#10171b" : "#f7f8f5");
    };

    applyTheme(initialTheme);

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        window.localStorage.setItem(themeStorageKey, nextTheme);
        applyTheme(nextTheme);
      });
    });
  }

  function setupCopyEmail() {
    const button = $("[data-copy-email]");
    const email = data.personal.email;
    button.addEventListener("click", async () => {
      if (!email || /^\[.*\]$/.test(email)) {
        showToast("Email is a placeholder. Replace personal.email in assets/js/data.js.");
        return;
      }

      try {
        await navigator.clipboard.writeText(email);
        showToast("Email copied to clipboard.");
      } catch {
        showToast(email);
      }
    });
  }

  function setupClickEffects() {
    document.addEventListener("pointerdown", (event) => {
      const target = event.target.closest("a, button, .snapshot-item, .interest-card, .publication-card");
      if (!target || prefersReducedMotion) return;

      const ripple = document.createElement("span");
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.className = "click-ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.classList.add("has-ripple");
      target.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 520);

      for (let index = 0; index < 6; index += 1) {
        const spark = document.createElement("span");
        const angle = (Math.PI * 2 * index) / 6;
        const distance = 14 + (index % 2) * 7;
        spark.className = "click-spark";
        spark.style.left = `${event.clientX}px`;
        spark.style.top = `${event.clientY}px`;
        spark.style.setProperty("--spark-x", `${Math.cos(angle) * distance}px`);
        spark.style.setProperty("--spark-y", `${Math.sin(angle) * distance}px`);
        document.body.appendChild(spark);
        window.setTimeout(() => spark.remove(), 460);
      }
    });
  }

  function setupInitialHashScroll() {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const scrollHome = () => {
      window.scrollTo({ top: 0, behavior: "auto" });
      $("#home")?.querySelectorAll(".reveal, .interest-card, .publication-card").forEach((item) => {
        item.classList.add("is-visible");
      });
    };

    const scrollToHash = () => {
      if (!window.location.hash || window.location.hash === "#home") {
        scrollHome();
        return;
      }
      const target = $(window.location.hash);
      if (!target) return;
      const headerOffset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 74;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset - 18;
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      target.querySelectorAll(".reveal, .interest-card, .publication-card").forEach((item) => {
        item.classList.add("is-visible");
      });
    };

    scrollToHash();
    window.setTimeout(scrollToHash, 60);
    window.setTimeout(scrollToHash, 260);
    if (document.fonts?.ready) {
      document.fonts.ready.then(scrollToHash).catch(() => {});
    }
    window.addEventListener("hashchange", () => {
      window.setTimeout(scrollToHash, 40);
      window.setTimeout(scrollToHash, 360);
    });
  }

  function setupBackToTop() {
    const button = $("[data-back-to-top]");
    window.addEventListener("scroll", () => {
      button.classList.toggle("is-visible", window.scrollY > 700);
    });
    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  function showToast(message) {
    const toast = $("[data-toast]");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function setupPlaceholderLinks() {
    $$("[data-placeholder]").forEach((link) => {
      if (link.dataset.boundPlaceholder) return;
      link.dataset.boundPlaceholder = "true";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Placeholder link. Replace the URL in assets/js/data.js.");
      });
    });
  }

  function setupSiteBackdropCanvas() {
    const canvas = $("[data-site-canvas]");
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let nodes = [];
    let animationFrame;
    const startTime = performance.now();

    function colors() {
      const isDark = document.documentElement.dataset.theme === "dark";
      return isDark
        ? {
            grid: "rgba(130, 214, 230, 0.055)",
            gridStrong: "rgba(130, 214, 230, 0.11)",
            line: "rgba(130, 214, 230, ",
            node: "rgba(155, 217, 210, 0.46)",
            scan: "rgba(130, 214, 230, 0.12)",
            pulse: "rgba(155, 217, 210, 0.55)"
          }
        : {
            grid: "rgba(23, 111, 107, 0.035)",
            gridStrong: "rgba(23, 111, 107, 0.075)",
            line: "rgba(23, 111, 107, ",
            node: "rgba(23, 111, 107, 0.32)",
            scan: "rgba(42, 142, 160, 0.075)",
            pulse: "rgba(42, 142, 160, 0.42)"
          };
    }

    function scrollRatio() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    }

    function resize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const nodeCount = Math.max(22, Math.min(54, Math.floor((width * height) / 26000)));
      nodes = Array.from({ length: nodeCount }, (_, index) => ({
        baseX: ((index * 137) % Math.max(width, 1)) + ((index % 3) - 1) * 18,
        baseY: ((index * 191) % Math.max(height, 1)) + ((index % 4) - 1.5) * 12,
        vx: (((index * 5) % 7) - 3) * 0.018,
        vy: (((index * 7) % 9) - 4) * 0.014,
        phase: index * 0.63,
        size: 1 + (index % 4) * 0.35
      }));

      if (prefersReducedMotion) draw();
    }

    function drawParticleLattice(theme, elapsed, ratio) {
      const spacing = width < 720 ? 58 : 68;
      const driftX = (elapsed * 0.008 + ratio * 42) % spacing;
      const driftY = (elapsed * 0.005 + ratio * 26) % spacing;

      for (let y = 18 - driftY; y < height + spacing; y += spacing) {
        for (let x = 16 - driftX; x < width + spacing; x += spacing) {
          const phase = Math.sin(elapsed * 0.0011 + x * 0.015 + y * 0.011);
          const radius = 0.7 + (phase + 1) * 0.45;
          const alpha = 0.026 + (phase + 1) * 0.02;
          context.fillStyle = theme.line + `${alpha})`;
          context.beginPath();
          context.arc(x + Math.sin(y * 0.015 + elapsed * 0.0006) * 4, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      for (let cluster = 0; cluster < 6; cluster += 1) {
        const x = ((cluster * 251 + elapsed * 0.018 + ratio * 180) % (width + 160)) - 80;
        const y = ((cluster * 173 + Math.sin(elapsed * 0.0008 + cluster) * 40) % (height + 120)) - 60;
        const gradient = context.createRadialGradient(x, y, 0, x, y, 92);
        gradient.addColorStop(0, theme.gridStrong);
        gradient.addColorStop(1, "rgba(42, 142, 160, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, 92, 0, Math.PI * 2);
        context.fill();
      }
    }

    function drawDataChannels(theme, elapsed, ratio) {
      const channelCount = Math.max(4, Math.min(8, Math.floor(width / 180)));
      for (let channel = 0; channel < channelCount; channel += 1) {
        const y = ((channel + 0.5) / channelCount) * height + Math.sin(elapsed * 0.0009 + channel) * 18;
        const startX = -120 + ((elapsed * (0.028 + channel * 0.004) + ratio * 260 + channel * 170) % (width + 240));
        for (let bead = 0; bead < 7; bead += 1) {
          const beadX = startX + bead * 18;
          const beadY = y + Math.sin(channel + ratio * Math.PI + bead * 0.34) * 18;
          const pulse = 1 - bead / 7;
          context.fillStyle = bead === 6 ? theme.pulse : theme.line + `${0.08 * pulse})`;
          context.beginPath();
          context.arc(beadX, beadY, bead === 6 ? 2.4 : 1.2 + pulse * 0.8, 0, Math.PI * 2);
          context.fill();
        }
      }
    }

    function drawNodeField(theme, elapsed, ratio) {
      const rendered = nodes.map((node, index) => {
        const x = (node.baseX + Math.sin(elapsed * 0.00055 + node.phase) * 16 + node.vx * elapsed + width) % width;
        const y = (node.baseY + Math.cos(elapsed * 0.00048 + node.phase) * 14 + node.vy * elapsed + ratio * 42 + height) % height;
        return { ...node, x, y, index };
      });

      rendered.forEach((node, index) => {
        for (let nextIndex = index + 1; nextIndex < rendered.length; nextIndex += 1) {
          const next = rendered[nextIndex];
          const distance = Math.hypot(node.x - next.x, node.y - next.y);
          if (distance > 142) continue;
          const dots = Math.max(3, Math.floor(distance / 24));
          for (let dot = 1; dot < dots; dot += 1) {
            if (dot % 2 === 0) continue;
            const progress = dot / dots;
            const alpha = 0.07 * (1 - distance / 142) * (1 - Math.abs(0.5 - progress) * 0.7);
            context.fillStyle = theme.line + `${alpha})`;
            context.beginPath();
            context.arc(node.x + (next.x - node.x) * progress, node.y + (next.y - node.y) * progress, 0.75, 0, Math.PI * 2);
            context.fill();
          }
        }
      });

      rendered.forEach((node) => {
        const pulse = 0.5 + Math.sin(elapsed * 0.0014 + node.phase) * 0.5;
        context.fillStyle = theme.node;
        context.beginPath();
        context.arc(node.x, node.y, node.size + pulse * 0.6, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawAmbientBursts(theme, elapsed, ratio) {
      for (let burst = 0; burst < 4; burst += 1) {
        const x = ((elapsed * (0.012 + burst * 0.002) + burst * 317 + ratio * 210) % (width + 180)) - 90;
        const y = height * (0.18 + burst * 0.21) + Math.sin(elapsed * 0.0009 + burst) * 34;
        const radius = 120 + Math.sin(elapsed * 0.001 + burst) * 18;
        const glow = context.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, theme.scan);
        glow.addColorStop(0.42, theme.line + "0.035)");
        glow.addColorStop(1, "rgba(42, 142, 160, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }

    function draw() {
      const elapsed = performance.now() - startTime;
      const theme = colors();
      const ratio = scrollRatio();
      context.clearRect(0, 0, width, height);
      drawParticleLattice(theme, elapsed, ratio);
      drawAmbientBursts(theme, elapsed, ratio);
      drawDataChannels(theme, elapsed, ratio);
      drawNodeField(theme, elapsed, ratio);

      if (!prefersReducedMotion) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    if (!prefersReducedMotion) animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener("beforeunload", () => window.cancelAnimationFrame(animationFrame));
  }

  function setupHeroCanvas() {
    const canvas = $("[data-hero-canvas]");
    const hero = $(".hero");
    const context = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let points = [];
    let packets = [];
    let animationFrame;
    const pointer = { x: 0, y: 0, active: false };
    const startTime = performance.now();

    function themeColors() {
      const isDark = document.documentElement.dataset.theme === "dark";
      return isDark
        ? {
            grid: "rgba(130, 214, 230, 0.08)",
            line: "rgba(130, 214, 230, ",
            node: "rgba(130, 214, 230, 0.62)",
            pulse: "rgba(155, 217, 210, 0.85)",
            ring: "rgba(130, 214, 230, 0.16)",
            bar: "rgba(130, 214, 230, 0.2)",
            scan: "rgba(130, 214, 230, 0.16)"
          }
        : {
            grid: "rgba(23, 111, 107, 0.075)",
            line: "rgba(23, 111, 107, ",
            node: "rgba(23, 111, 107, 0.5)",
            pulse: "rgba(42, 142, 160, 0.72)",
            ring: "rgba(42, 142, 160, 0.18)",
            bar: "rgba(23, 111, 107, 0.16)",
            scan: "rgba(42, 142, 160, 0.13)"
          };
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const pointCount = Math.max(34, Math.min(78, Math.floor(width / 26)));
      points = Array.from({ length: pointCount }, (_, index) => {
        const column = (index * 7) % 13;
        const row = Math.floor(index / 13);
        return {
          x: ((column + 0.5) / 13) * width + ((index * 19) % 35) - 17,
          y: 48 + ((row * 96 + index * 37) % Math.max(height - 96, 1)),
          vx: (((index * 3) % 5) - 2) * 0.055,
          vy: (((index * 5) % 7) - 3) * 0.038,
          r: 1.25 + (index % 5) * 0.28,
          phase: index * 0.41
        };
      });

      packets = Array.from({ length: Math.max(7, Math.floor(width / 160)) }, (_, index) => ({
        x: (index * 211) % Math.max(width, 1),
        y: 88 + ((index * 157) % Math.max(height - 150, 1)),
        speed: 0.36 + (index % 4) * 0.16,
        length: 34 + (index % 3) * 18,
        offset: index * 0.7
      }));
    }

    function drawSignalMatrix(colors, elapsed) {
      const spacing = width < 680 ? 36 : 44;
      for (let y = 26; y < height; y += spacing) {
        for (let x = 20; x < width; x += spacing) {
          const phase = Math.sin(elapsed * 0.0014 + x * 0.021 + y * 0.017);
          const alpha = 0.035 + (phase + 1) * 0.026;
          const radius = phase > 0.74 ? 1.9 : 0.9;
          context.fillStyle = colors.line + `${alpha})`;
          context.beginPath();
          context.arc(x + Math.sin(elapsed * 0.0007 + y) * 3, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      for (let bloom = 0; bloom < 4; bloom += 1) {
        const x = ((bloom * 289 + elapsed * 0.025) % (width + 120)) - 60;
        const y = height * (0.2 + bloom * 0.18) + Math.cos(elapsed * 0.001 + bloom) * 30;
        const gradient = context.createRadialGradient(x, y, 0, x, y, 110);
        gradient.addColorStop(0, colors.scan);
        gradient.addColorStop(0.45, colors.line + "0.035)");
        gradient.addColorStop(1, "rgba(42, 142, 160, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, 110, 0, Math.PI * 2);
        context.fill();
      }
    }

    function drawTelemetryArcs(colors, elapsed) {
      const anchors = [
        { x: width * 0.14, y: height * 0.3, base: Math.min(width, height) * 0.16, speed: 0.00018 },
        { x: width * 0.78, y: height * 0.28, base: Math.min(width, height) * 0.18, speed: -0.00014 },
        { x: width * 0.52, y: height * 0.76, base: Math.min(width, height) * 0.22, speed: 0.00012 }
      ];

      context.lineWidth = 1;
      anchors.forEach((anchor, anchorIndex) => {
        const rotation = elapsed * anchor.speed + anchorIndex * 0.8;
        for (let ring = 0; ring < 3; ring += 1) {
          const radius = anchor.base + ring * 28;
          const start = rotation + ring * 0.72;
          const end = start + Math.PI * (0.52 + ring * 0.1);
          const steps = 18 + ring * 4;
          for (let step = 0; step <= steps; step += 1) {
            if (step % 2 === 1) continue;
            const angle = start + (end - start) * (step / steps);
            context.fillStyle = colors.ring;
            context.beginPath();
            context.arc(anchor.x + Math.cos(angle) * radius, anchor.y + Math.sin(angle) * radius, 1.05 + ring * 0.12, 0, Math.PI * 2);
            context.fill();
          }
        }

        context.fillStyle = colors.node;
        context.beginPath();
        context.arc(anchor.x, anchor.y, 2.2, 0, Math.PI * 2);
        context.fill();
      });
    }

    function drawSignalBars(colors, elapsed) {
      const groupCount = Math.max(5, Math.floor(width / 210));
      for (let group = 0; group < groupCount; group += 1) {
        const x = 28 + ((group * 263 + elapsed * 0.032) % Math.max(width - 56, 1));
        const y = 74 + ((group * 173) % Math.max(height - 148, 1));
        for (let bar = 0; bar < 7; bar += 1) {
          const heightScale = 0.35 + Math.sin(elapsed * 0.004 + group + bar * 0.72) * 0.32 + bar * 0.035;
          context.fillStyle = colors.bar;
          context.fillRect(x + bar * 7, y + 18 * (1 - heightScale), 3, Math.max(3, 18 * heightScale));
        }
      }
    }

    function drawPackets(colors, elapsed) {
      packets.forEach((packet) => {
        const x = (packet.x + elapsed * packet.speed) % (width + packet.length * 2);
        const y = packet.y + Math.sin(elapsed * 0.002 + packet.offset) * 18;
        for (let index = 0; index < 6; index += 1) {
          const alpha = 1 - index / 6;
          context.fillStyle = index === 0 ? colors.pulse : colors.line + `${0.11 * alpha})`;
          context.beginPath();
          context.arc(x - index * 10, y + Math.sin(index * 0.5 + packet.offset) * 2.5, 1.1 + alpha * 1.4, 0, Math.PI * 2);
          context.fill();
        }
      });
    }

    function draw() {
      const elapsed = performance.now() - startTime;
      const colors = themeColors();
      context.clearRect(0, 0, width, height);
      drawSignalMatrix(colors, elapsed);
      drawTelemetryArcs(colors, elapsed);
      drawSignalBars(colors, elapsed);
      drawPackets(colors, elapsed);

      points.forEach((point, index) => {
        if (!prefersReducedMotion) {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < -20) point.x = width + 20;
          if (point.x > width + 20) point.x = -20;
          if (point.y < -20) point.y = height + 20;
          if (point.y > height + 20) point.y = -20;
        }

        const pulse = 0.5 + Math.sin(elapsed * 0.0017 + point.phase) * 0.5;
        const pointerDx = pointer.active ? pointer.x - point.x : 0;
        const pointerDy = pointer.active ? pointer.y - point.y : 0;
        const pointerDistance = Math.sqrt(pointerDx * pointerDx + pointerDy * pointerDy);
        point.renderX = point.x - pointerDx * Math.max(0, 1 - pointerDistance / 240) * 0.055;
        point.renderY = point.y - pointerDy * Math.max(0, 1 - pointerDistance / 240) * 0.055;
        point.alpha = 0.34 + pulse * 0.18 + Math.max(0, 1 - pointerDistance / 210) * 0.22;

        for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
          const next = points[nextIndex];
          const dx = point.renderX - (next.renderX ?? next.x);
          const dy = point.renderY - (next.renderY ?? next.y);
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 156) {
            const pointerBoost =
              pointer.active && Math.hypot(pointer.x - point.renderX, pointer.y - point.renderY) < 240 ? 0.07 : 0;
            const nextX = next.renderX ?? next.x;
            const nextY = next.renderY ?? next.y;
            const dots = Math.max(3, Math.floor(distance / 22));
            for (let dot = 1; dot < dots; dot += 1) {
              if (dot % 2 === 0) continue;
              const progress = dot / dots;
              const alpha = 0.12 * (1 - distance / 156) + pointerBoost * 0.7;
              context.fillStyle = colors.line + `${alpha})`;
              context.beginPath();
              context.arc(
                point.renderX + (nextX - point.renderX) * progress,
                point.renderY + (nextY - point.renderY) * progress,
                0.8,
                0,
                Math.PI * 2
              );
              context.fill();
            }
          }
        }
      });

      points.forEach((point) => {
        context.fillStyle = colors.node;
        context.beginPath();
        context.arc(point.renderX, point.renderY, point.r, 0, Math.PI * 2);
        context.fill();

        const halo = context.createRadialGradient(point.renderX, point.renderY, point.r, point.renderX, point.renderY, point.r + 8);
        halo.addColorStop(0, colors.line + `${Math.min(0.16, point.alpha * 0.42)})`);
        halo.addColorStop(1, colors.line + "0)");
        context.fillStyle = halo;
        context.beginPath();
        context.arc(point.renderX, point.renderY, point.r + 8, 0, Math.PI * 2);
        context.fill();
      });

      if (!prefersReducedMotion) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    hero.addEventListener(
      "pointermove",
      (event) => {
        const rect = hero.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.active = true;
      },
      { passive: true }
    );
    hero.addEventListener("pointerleave", () => {
      pointer.active = false;
    });
    if (!prefersReducedMotion) animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener("beforeunload", () => window.cancelAnimationFrame(animationFrame));
  }

  function init() {
    renderBasics();
    renderAbout();
    renderSnapshot();
    renderEducation();
    renderInterests();
    renderPublicationFilters();
    renderPublications();
    renderHonors();
    renderService();
    renderNews();
    renderContact();

    setupTheme();
    setupNavigation();
    setupPublicationFilters();
    setupPublicationYearFilter();
    setupPublicationSearch();
    setupBibtexActions();
    setupHonorsToggle();
    setupNewsToggle();
    setupBackToTop();
    setupCopyEmail();
    setupClickEffects();
    setupPlaceholderLinks();
    setupReveal();
    setupSiteBackdropCanvas();
    setupHeroCanvas();
    setupInitialHashScroll();
  }

  init();
})();
