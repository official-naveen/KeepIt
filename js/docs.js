document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('docs-search-input');
  const docSections = document.querySelectorAll('.doc-section');
  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  const noResultsBox = document.getElementById('search-no-results');

  // Global keyboard shortcut '/' to focus search input
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      let visibleCount = 0;

      docSections.forEach(section => {
        const text = section.textContent.toLowerCase();
        if (text.includes(query)) {
          section.style.display = 'block';
          visibleCount++;
        } else {
          section.style.display = 'none';
        }
      });

      if (visibleCount === 0 && query !== '') {
        if (noResultsBox) noResultsBox.style.display = 'block';
      } else {
        if (noResultsBox) noResultsBox.style.display = 'none';
      }
    });
  }

  // Highlight active sidebar link on scroll
  window.addEventListener('scroll', () => {
    let current = '';
    docSections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (window.pageYOffset >= sectionTop - 120) {
        current = section.getAttribute('id');
      }
    });

    sidebarLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
});
