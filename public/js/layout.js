document.addEventListener('DOMContentLoaded', () => {
  // Ensure we have FontAwesome loaded for icons
  if (!document.getElementById('font-awesome-cdn')) {
    const link = document.createElement('link');
    link.id = 'font-awesome-cdn';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
  }

  // 1. Inject Sidebar and Header HTML Shell
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    // Determine active menu item
    const path = window.location.pathname;
    const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    // Create Sidebar
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <i class="fa-solid fa-bolt-lightning" style="margin-right: 8px;"></i> ClubPulse
      </div>
      <ul class="sidebar-menu">
        <li class="sidebar-menu-item ${pageName === 'index.html' ? 'active' : ''}">
          <a href="index.html">
            <i class="fa-solid fa-chart-line"></i> Dashboard
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'members.html' ? 'active' : ''}">
          <a href="members.html">
            <i class="fa-solid fa-users"></i> Members
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'events.html' ? 'active' : ''}">
          <a href="events.html">
            <i class="fa-solid fa-calendar-days"></i> Events
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'participants.html' ? 'active' : ''}">
          <a href="participants.html">
            <i class="fa-solid fa-people-group"></i> Teams
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'problems.html' ? 'active' : ''}">
          <a href="problems.html">
            <i class="fa-solid fa-code"></i> Problems
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'analytics.html' ? 'active' : ''}">
          <a href="analytics.html">
            <i class="fa-solid fa-square-poll-vertical"></i> Analytics
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'reports.html' ? 'active' : ''}">
          <a href="reports.html">
            <i class="fa-solid fa-brain"></i> AI Reports
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'scan.html' ? 'active' : ''}">
          <a href="scan.html">
            <i class="fa-solid fa-qrcode"></i> QR Scanner
          </a>
        </li>
        
        <li style="margin: 20px 0 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1.5px;">
          Public Portals
        </li>
        <li class="sidebar-menu-item ${pageName === 'register.html' ? 'active' : ''}">
          <a href="register.html">
            <i class="fa-solid fa-user-plus"></i> Team Register
          </a>
        </li>
        <li class="sidebar-menu-item ${pageName === 'attend.html' ? 'active' : ''}">
          <a href="attend.html">
            <i class="fa-solid fa-clipboard-user"></i> Self Check-in
          </a>
        </li>
      </ul>
      <div class="sidebar-footer">
        <div>ClubPulse v1.0.0</div>
        <div style="font-size: 10px; margin-top: 4px;">Developer Workspace</div>
      </div>
    `;

    // Create Main Content wrapper if not present
    let mainContent = document.querySelector('.main-content');
    if (!mainContent) {
      mainContent = document.createElement('div');
      mainContent.className = 'main-content';
      // Move all current body children (excluding sidebar) to mainContent
      while (appContainer.firstChild) {
        mainContent.appendChild(appContainer.firstChild);
      }
      appContainer.appendChild(mainContent);
    }

    // Insert Sidebar before Main Content
    appContainer.insertBefore(sidebar, mainContent);

    // Create Header if not present in main-content
    let topHeader = document.querySelector('.top-header');
    if (!topHeader) {
      topHeader = document.createElement('header');
      topHeader.className = 'top-header';
      
      // Get title from page document metadata or determine from filename
      let documentTitle = document.title.replace('ClubPulse - ', '');
      if (documentTitle === 'Document' || !documentTitle) {
        const titleMap = {
          'index.html': 'Dashboard Overview',
          'members.html': 'Members Management',
          'events.html': 'Events & Meetings',
          'participants.html': 'Teams & Participants',
          'problems.html': 'Hackathon Problems',
          'analytics.html': 'Analytics Hub',
          'reports.html': 'AI Reports & Forecasts',
          'scan.html': 'Camera Attendance Scanner',
          'register.html': 'Hackathon Registration',
          'attend.html': 'Event Self Check-in'
        };
        documentTitle = titleMap[pageName] || 'Smart Dashboard';
      }

      topHeader.innerHTML = `
        <div class="header-left">
          <div class="menu-toggle"><i class="fa-solid fa-bars"></i></div>
          <h1 class="page-title">${documentTitle}</h1>
        </div>
        <div class="header-right">
          <div class="clock" id="nav-clock">00:00:00</div>
          <div class="db-status" id="db-status-badge">
            <span class="status-dot active"></span>
            <span id="db-status-text">Connecting...</span>
          </div>
        </div>
      `;
      mainContent.insertBefore(topHeader, mainContent.firstChild);
    }

    // Mobile Sidebar Drawer Toggle Logic
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
      });
    }

    // Close mobile sidebar if clicking outside of it
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
          sidebar.classList.remove('active');
        }
      }
    });

    // 2. Setup Clock
    const clockEl = document.getElementById('nav-clock');
    if (clockEl) {
      const updateClock = () => {
        const now = new Date();
        clockEl.textContent = now.toTimeString().split(' ')[0];
      };
      updateClock();
      setInterval(updateClock, 1000);
    }

    // 3. Fetch Server Status to update DB connection badge
    const badge = document.getElementById('db-status-badge');
    const text = document.getElementById('db-status-text');
    if (badge && text) {
      fetch('/api/status')
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(data => {
          if (data.databaseConnected) {
            badge.className = 'db-status';
            text.textContent = 'MongoDB Online';
          } else if (data.useMockFallback) {
            badge.className = 'db-status offline';
            text.textContent = 'Mock DB Offline Mode';
          }
        })
        .catch(() => {
          badge.className = 'db-status offline';
          text.textContent = 'API Connection Error';
        });
    }
  }
});
