document.addEventListener('DOMContentLoaded', () => {
  // Ensure we have FontAwesome loaded for icons
  if (!document.getElementById('font-awesome-cdn')) {
    const link = document.createElement('link');
    link.id = 'font-awesome-cdn';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
  }

  // 1. Inject Horizontal Navigation Header Shell
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    const path = window.location.pathname;
    const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    // Get current user info
    const user = window.AuthHelper ? window.AuthHelper.getUser() : null;
    const userName = user ? user.name : 'Admin';
    const userClub = user ? (user.clubName || 'My Club') : 'ClubPulse';
    const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Create top navigation header element
    const header = document.createElement('header');
    header.className = 'top-header';
    header.innerHTML = `
      <div class="header-left">
        <!-- Brand logo -->
        <a href="index.html" class="nav-brand" style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 20px; background: linear-gradient(135deg, var(--violet), var(--mint)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-right: 24px;">
          <i class="fa-solid fa-bolt-lightning" style="color: var(--mint);"></i> ClubPulse
        </a>
        
        <!-- Desktop Nav menu -->
        <ul class="nav-menu" style="display: flex; align-items: center; gap: 6px; list-style: none; margin: 0; padding: 0;">
          <li class="nav-item ${pageName === 'index.html' ? 'active' : ''}">
            <a href="index.html"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
          </li>
          <li class="nav-item ${pageName === 'members.html' ? 'active' : ''}">
            <a href="members.html"><i class="fa-solid fa-users"></i> Members</a>
          </li>
          <li class="nav-item ${pageName === 'events.html' ? 'active' : ''}">
            <a href="events.html"><i class="fa-solid fa-calendar-days"></i> Events</a>
          </li>
          <li class="nav-item ${pageName === 'participants.html' ? 'active' : ''}">
            <a href="participants.html"><i class="fa-solid fa-people-group"></i> Teams</a>
          </li>
          <li class="nav-item ${pageName === 'problems.html' ? 'active' : ''}">
            <a href="problems.html"><i class="fa-solid fa-code"></i> Problems</a>
          </li>
          <li class="nav-item ${pageName === 'attendance.html' ? 'active' : ''}">
            <a href="attendance.html"><i class="fa-solid fa-clipboard-user"></i> Attendance</a>
          </li>
          <li class="nav-item ${pageName === 'analytics.html' ? 'active' : ''}">
            <a href="analytics.html"><i class="fa-solid fa-square-poll-vertical"></i> Analytics</a>
          </li>
          
          <!-- AI Utilities Dropdown -->
          <li class="nav-item dropdown ${['matchmaker.html', 'reports.html', 'mentor.html', 'pitch-analyzer.html', 'scan.html'].includes(pageName) ? 'active' : ''}" style="position: relative;">
            <a href="#" class="dropdown-trigger" style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <i class="fa-solid fa-sparkles"></i> AI Utilities <i class="fa-solid fa-chevron-down" style="font-size: 10px; margin-left: 2px;"></i>
            </a>
            <ul class="dropdown-content">
              <li class="${pageName === 'matchmaker.html' ? 'active' : ''}"><a href="matchmaker.html"><i class="fa-solid fa-people-arrows"></i> AI Matchmaker</a></li>
              <li class="${pageName === 'reports.html' ? 'active' : ''}"><a href="reports.html"><i class="fa-solid fa-brain"></i> AI Reports</a></li>
              <li class="${pageName === 'mentor.html' ? 'active' : ''}"><a href="mentor.html"><i class="fa-solid fa-comments"></i> Chat Mentor</a></li>
              <li class="${pageName === 'pitch-analyzer.html' ? 'active' : ''}"><a href="pitch-analyzer.html"><i class="fa-solid fa-wand-magic-sparkles"></i> Pitch Analyzer</a></li>
              <li class="${pageName === 'scan.html' ? 'active' : ''}"><a href="scan.html"><i class="fa-solid fa-qrcode"></i> QR Scanner</a></li>
            </ul>
          </li>

          <!-- Public Portals Dropdown -->
          <li class="nav-item dropdown ${['register.html', 'attend.html', 'marketing.html'].includes(pageName) ? 'active' : ''}" style="position: relative;">
            <a href="#" class="dropdown-trigger" style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <i class="fa-solid fa-link"></i> Portals <i class="fa-solid fa-chevron-down" style="font-size: 10px; margin-left: 2px;"></i>
            </a>
            <ul class="dropdown-content">
              <li class="${pageName === 'register.html' ? 'active' : ''}"><a href="register.html"><i class="fa-solid fa-user-plus"></i> Team Register</a></li>
              <li class="${pageName === 'attend.html' ? 'active' : ''}"><a href="attend.html"><i class="fa-solid fa-clipboard-user"></i> Self Check-in</a></li>
              <li class="${pageName === 'marketing.html' ? 'active' : ''}"><a href="marketing.html"><i class="fa-solid fa-bullhorn"></i> Marketing Flyer</a></li>
            </ul>
          </li>
        </ul>
      </div>

      <div class="header-right">
        <div class="clock" id="nav-clock">00:00:00</div>
        <div class="db-status" id="db-status-badge">
          <span class="status-dot active"></span>
          <span id="db-status-text">Connecting...</span>
        </div>
        
        <!-- User Profile Bubble / Dropdown -->
        <div class="user-profile-menu" style="position: relative;">
          <div class="profile-avatar-trigger" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--violet), var(--mint)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; color: #ffffff; cursor: pointer; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(16,185,129,0.15); transition: transform 0.2s;">
            ${userInitials}
          </div>
          <div class="profile-dropdown-content">
            <div class="profile-info-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
              <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${userName}</div>
              <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">${userClub}</div>
            </div>
            <div style="padding: 8px;">
              <button onclick="if(window.AuthHelper) window.AuthHelper.logout()" style="width: 100%; text-align: left; background: none; border: none; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--rose); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.2s;" onmouseover="this.style.background='rgba(220,38,38,0.05)'" onmouseout="this.style.background='none'">
                <i class="fa-solid fa-right-from-bracket"></i> Sign Out
              </button>
            </div>
          </div>
        </div>
        
        <!-- Mobile Burger Icon -->
        <div class="menu-toggle" id="mobile-hamburger-btn" style="cursor: pointer;">
          <i class="fa-solid fa-bars"></i>
        </div>
      </div>

      <!-- Mobile Side Drawer (collapsible menu) -->
      <div class="mobile-drawer" id="mobile-drawer-menu">
        <div class="mobile-drawer-header" style="display: flex; align-items: center; justify-content: space-between; padding: 20px; border-bottom: 1px solid var(--border-color);">
          <span class="nav-brand" style="font-weight: 800; font-size: 20px; background: linear-gradient(135deg, var(--violet), var(--mint)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            <i class="fa-solid fa-bolt-lightning" style="color: var(--mint);"></i> ClubPulse
          </span>
          <i class="fa-solid fa-xmark" id="close-drawer-trigger" style="font-size: 20px; cursor: pointer; color: var(--text-secondary);"></i>
        </div>
        <div class="mobile-drawer-body" style="padding: 20px; overflow-y: auto; flex: 1;">
          <ul class="mobile-nav-list" style="list-style: none; display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0;">
            <li class="${pageName === 'index.html' ? 'active' : ''}"><a href="index.html"><i class="fa-solid fa-chart-line"></i> Dashboard</a></li>
            <li class="${pageName === 'members.html' ? 'active' : ''}"><a href="members.html"><i class="fa-solid fa-users"></i> Members</a></li>
            <li class="${pageName === 'events.html' ? 'active' : ''}"><a href="events.html"><i class="fa-solid fa-calendar-days"></i> Events</a></li>
            <li class="${pageName === 'participants.html' ? 'active' : ''}"><a href="participants.html"><i class="fa-solid fa-people-group"></i> Teams</a></li>
            <li class="${pageName === 'problems.html' ? 'active' : ''}"><a href="problems.html"><i class="fa-solid fa-code"></i> Problems</a></li>
            <li class="${pageName === 'attendance.html' ? 'active' : ''}"><a href="attendance.html"><i class="fa-solid fa-clipboard-user"></i> Attendance</a></li>
            <li class="${pageName === 'analytics.html' ? 'active' : ''}"><a href="analytics.html"><i class="fa-solid fa-square-poll-vertical"></i> Analytics</a></li>
            
            <li class="mobile-drawer-subheader" style="margin-top: 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px;">AI Utilities</li>
            <li class="${pageName === 'matchmaker.html' ? 'active' : ''}"><a href="matchmaker.html"><i class="fa-solid fa-people-arrows"></i> AI Matchmaker</a></li>
            <li class="${pageName === 'reports.html' ? 'active' : ''}"><a href="reports.html"><i class="fa-solid fa-brain"></i> AI Reports</a></li>
            <li class="${pageName === 'mentor.html' ? 'active' : ''}"><a href="mentor.html"><i class="fa-solid fa-comments"></i> Chat Mentor</a></li>
            <li class="${pageName === 'pitch-analyzer.html' ? 'active' : ''}"><a href="pitch-analyzer.html"><i class="fa-solid fa-wand-magic-sparkles"></i> Pitch Analyzer</a></li>
            <li class="${pageName === 'scan.html' ? 'active' : ''}"><a href="scan.html"><i class="fa-solid fa-qrcode"></i> QR Scanner</a></li>
            
            <li class="mobile-drawer-subheader" style="margin-top: 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px;">Public Portals</li>
            <li class="${pageName === 'register.html' ? 'active' : ''}"><a href="register.html"><i class="fa-solid fa-user-plus"></i> Team Register</a></li>
            <li class="${pageName === 'attend.html' ? 'active' : ''}"><a href="attend.html"><i class="fa-solid fa-clipboard-user"></i> Self Check-in</a></li>
            <li class="${pageName === 'marketing.html' ? 'active' : ''}"><a href="marketing.html"><i class="fa-solid fa-bullhorn"></i> Marketing Flyer</a></li>
          </ul>
        </div>
        <div class="mobile-drawer-footer" style="padding: 20px; border-top: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 10px; background: rgba(16,185,129,0.04); border-radius: 10px; border: 1px solid var(--border-color);">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--violet), var(--mint)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; color: #ffffff;">
              ${userInitials}
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${userName}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${userClub}</div>
            </div>
          </div>
          <button onclick="if(window.AuthHelper) window.AuthHelper.logout()" style="width: 100%; background: rgba(220,38,38,0.05); border: 1px solid rgba(220,38,38,0.15); color: var(--rose); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <i class="fa-solid fa-right-from-bracket"></i> Sign Out
          </button>
        </div>
      </div>
      <div class="mobile-drawer-overlay" id="mobile-drawer-overlay"></div>
    `;

    // Create Main Content wrapper if not present to contain child elements
    let mainContent = document.querySelector('.main-content');
    if (!mainContent) {
      mainContent = document.createElement('div');
      mainContent.className = 'main-content';
      while (appContainer.firstChild) {
        mainContent.appendChild(appContainer.firstChild);
      }
      appContainer.appendChild(mainContent);
    }

    // Insert Header before Main Content inside the app-container
    appContainer.insertBefore(header, mainContent);

    // Set flex column layout on appContainer to stack header and content properly
    appContainer.style.flexDirection = 'column';

    // Mobile Sidebar Drawer Toggle Logic
    const hamburgerBtn = document.getElementById('mobile-hamburger-btn');
    const closeBtn = document.getElementById('close-drawer-trigger');
    const drawerMenu = document.getElementById('mobile-drawer-menu');
    const drawerOverlay = document.getElementById('mobile-drawer-overlay');

    if (hamburgerBtn && drawerMenu && drawerOverlay) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        drawerMenu.classList.add('active');
        drawerOverlay.classList.add('active');
      });
    }

    const closeDrawer = () => {
      if (drawerMenu) drawerMenu.classList.remove('active');
      if (drawerOverlay) drawerOverlay.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    // Close mobile drawer on desktop resizing automatically
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        closeDrawer();
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
        .then(res => { if (!res.ok) throw new Error(); return res.json(); })
        .then(data => {
          if (data.databaseConnected) {
            badge.className = 'db-status';
            text.textContent = 'MongoDB Online';
          } else if (data.useMockFallback) {
            badge.className = 'db-status offline';
            text.textContent = 'Mock DB Mode';
          }
        })
        .catch(() => {
          badge.className = 'db-status offline';
          text.textContent = 'API Error';
        });
    }
  }
});
