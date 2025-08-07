// Backoffice Modern JavaScript - Interactive UI/UX Enhancements

// Sound Effect URLs (using free sounds)
const soundEffects = {
  hover: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBS571PDbizQIHWLB7+OUSg0QUqzn77JvHAU7k9/yyHkwBSuBzvLZijYIG2i86+egTw0OUqvn8LNxIAg=',
  click: 'data:audio/wav;base64,UklGRhIBAABXQVZFZm10IBAAAAABAAEAiBUAAIgVAAABAAgAZGF0YQABAAAAAAAA',
  success: 'data:audio/wav;base64,UklGRl4CAABXQVZFZm10IBAAAAABAAEAiBUAAIgVAAABAAgAZGF0YQYCAACCgYB+fHp4dnRycG5sa2lnZWNhX11bWllXVVNRUE5MS0lHRkRCQD8+PDs6ODc1NDIxLy4sKykoJiUjIiAfHRwbGRgWFRQSERAPDQwLCQgHBgQDAgEAAAAAAAAAAAAAAAAAAAICAwQGBwgJCwwNDxARExQVFxgaGxweHyEiJCUnKCosLS8wMjM1Njg5Oz0+QEFDRUZISUpMTU9QUVNVV1haXF1fYWJkZmdpamxucHFzdHZ3eXp8fn6AgYE='
};

// Initialize audio objects
const sounds = {};
Object.keys(soundEffects).forEach(key => {
  sounds[key] = new Audio(soundEffects[key]);
  sounds[key].volume = 0.2;
});

// Theme Manager
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    this.setupToggle();
  }

  setupToggle() {
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
    
    // Play sound effect
    playSound('click');
    
    // Add transition effect
    document.body.style.transition = 'background-color 0.3s ease';
  }
}

// Particle System
class ParticleSystem {
  constructor() {
    this.container = document.querySelector('.particles');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'particles';
      document.body.appendChild(this.container);
    }
    this.particles = [];
    this.init();
  }

  init() {
    for (let i = 0; i < 50; i++) {
      this.createParticle();
    }
  }

  createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 20 + 10) + 's';
    particle.style.animationDelay = Math.random() * 20 + 's';
    this.container.appendChild(particle);
  }
}

// Sound Manager
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

function playSound(type) {
  if (soundEnabled && sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(e => console.log('Sound play failed:', e));
  }
}

// Add hover sounds to interactive elements
function addHoverSounds() {
  const interactiveElements = document.querySelectorAll('button, a, .clickable, .nav-item-modern, .fab, .action-btn');
  
  interactiveElements.forEach(element => {
    element.addEventListener('mouseenter', () => playSound('hover'));
    element.addEventListener('click', () => playSound('click'));
  });
}

// Parallax Scrolling
class ParallaxController {
  constructor() {
    this.elements = document.querySelectorAll('.parallax-element');
    this.init();
  }

  init() {
    window.addEventListener('scroll', () => this.handleScroll());
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
  }

  handleScroll() {
    const scrolled = window.pageYOffset;
    
    this.elements.forEach(element => {
      const speed = element.dataset.speed || 0.5;
      const yPos = -(scrolled * speed);
      element.style.transform = `translateY(${yPos}px)`;
    });
  }

  handleMouseMove(e) {
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    this.elements.forEach(element => {
      const speedX = element.dataset.speedX || 0.05;
      const speedY = element.dataset.speedY || 0.05;
      const x = (mouseX - 0.5) * speedX * 100;
      const y = (mouseY - 0.5) * speedY * 100;
      
      element.style.transform = `translate(${x}px, ${y}px)`;
    });
  }
}

// Smooth Page Transitions
class PageTransition {
  constructor() {
    this.init();
  }

  init() {
    // Add transition class to all links
    document.querySelectorAll('a:not([target="_blank"])').forEach(link => {
      link.addEventListener('click', (e) => this.handleTransition(e));
    });
  }

  handleTransition(e) {
    const link = e.currentTarget;
    const href = link.getAttribute('href');
    
    // Skip if it's a hash link or external link
    if (href.startsWith('#') || href.startsWith('http')) return;
    
    e.preventDefault();
    document.body.classList.add('page-transition-out');
    
    setTimeout(() => {
      window.location.href = href;
    }, 300);
  }
}

// Interactive Charts using Chart.js
function initializeCharts() {
  const chartContainers = document.querySelectorAll('.chart-container canvas');
  
  chartContainers.forEach(canvas => {
    const type = canvas.dataset.chartType || 'line';
    const ctx = canvas.getContext('2d');
    
    // Sample data - replace with actual data
    const data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Revenue',
        data: [12000, 19000, 15000, 25000, 22000, 30000],
        borderColor: 'rgb(102, 126, 234)',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4
      }]
    };
    
    new Chart(ctx, {
      type: type,
      data: data,
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  });
}

// Number Counter Animation
function animateNumbers() {
  const numbers = document.querySelectorAll('.stat-number[data-value]');
  
  numbers.forEach(number => {
    const finalValue = parseInt(number.dataset.value);
    const duration = 2000;
    const stepTime = 30;
    const steps = duration / stepTime;
    const stepValue = finalValue / steps;
    let currentValue = 0;
    
    const counter = setInterval(() => {
      currentValue += stepValue;
      
      if (currentValue >= finalValue) {
        currentValue = finalValue;
        clearInterval(counter);
      }
      
      number.textContent = Math.floor(currentValue).toLocaleString();
    }, stepTime);
  });
}

// Search Bar Functionality
class SearchBar {
  constructor() {
    this.searchBar = document.querySelector('.search-bar');
    this.searchInput = document.querySelector('.search-input');
    this.searchIcon = document.querySelector('.search-icon');
    
    if (this.searchBar) {
      this.init();
    }
  }

  init() {
    this.searchIcon.addEventListener('click', () => this.toggle());
    this.searchInput.addEventListener('blur', () => {
      if (this.searchInput.value === '') {
        this.close();
      }
    });
  }

  toggle() {
    if (this.searchBar.classList.contains('active')) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.searchBar.classList.add('active');
    this.searchInput.focus();
    playSound('click');
  }

  close() {
    this.searchBar.classList.remove('active');
    this.searchInput.value = '';
  }
}

// Live Activity Feed
class ActivityFeed {
  constructor() {
    this.feed = document.querySelector('.activity-feed');
    if (this.feed) {
      this.init();
    }
  }

  init() {
    // Simulate real-time updates
    setInterval(() => {
      this.addActivity();
    }, 10000);
  }

  addActivity() {
    const activities = [
      'New user registered',
      'Order completed',
      'Payment received',
      'System backup completed',
      'New merchant added'
    ];
    
    const activity = activities[Math.floor(Math.random() * activities.length)];
    const item = document.createElement('div');
    item.className = 'activity-item-modern';
    item.innerHTML = `
      <div class="activity-indicator"></div>
      <div class="activity-content">
        <div class="activity-action">${activity}</div>
        <div class="activity-time">Just now</div>
      </div>
    `;
    
    this.feed.insertBefore(item, this.feed.firstChild);
    
    // Remove old items
    if (this.feed.children.length > 10) {
      this.feed.removeChild(this.feed.lastChild);
    }
  }
}

// Easter Eggs
class EasterEggs {
  constructor() {
    this.konami = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    this.current = 0;
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.checkKonami(e));
  }

  checkKonami(e) {
    if (e.keyCode === this.konami[this.current]) {
      this.current++;
      
      if (this.current === this.konami.length) {
        this.trigger();
        this.current = 0;
      }
    } else {
      this.current = 0;
    }
  }

  trigger() {
    const emoji = ['🎉', '🚀', '⭐', '🎨', '🔥'][Math.floor(Math.random() * 5)];
    const egg = document.createElement('div');
    egg.className = 'easter-egg';
    egg.textContent = emoji;
    document.body.appendChild(egg);
    
    playSound('success');
    
    setTimeout(() => {
      egg.remove();
    }, 3000);
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create animated background if not exists
  if (!document.querySelector('.animated-bg')) {
    const bg = document.createElement('div');
    bg.className = 'animated-bg';
    document.body.appendChild(bg);
  }

  // Initialize all systems
  new ThemeManager();
  new ParticleSystem();
  new ParallaxController();
  new PageTransition();
  new SearchBar();
  new ActivityFeed();
  new EasterEggs();
  
  // Add interactive sounds
  addHoverSounds();
  
  // Animate numbers on page load
  animateNumbers();
  
  // Initialize charts if Chart.js is loaded
  if (typeof Chart !== 'undefined') {
    initializeCharts();
  }
  
  // Add floating action button interactions
  const fab = document.querySelector('.fab');
  if (fab) {
    fab.addEventListener('click', () => {
      // Add ripple effect
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      fab.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  }
  
  // Add loading animation to async operations
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function() {
      const submitBtn = this.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<div class="loader-dots"><div class="loader-dot"></div><div class="loader-dot"></div><div class="loader-dot"></div></div>';
        submitBtn.disabled = true;
      }
    });
  });
  
  // Sound toggle
  const soundToggle = document.createElement('button');
  soundToggle.className = 'sound-toggle fab';
  soundToggle.style.cssText = 'bottom: 120px; width: 40px; height: 40px; font-size: 18px;';
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  soundToggle.onclick = () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled', soundEnabled);
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    playSound('click');
  };
  
  const fabContainer = document.querySelector('.fab-container');
  if (fabContainer) {
    fabContainer.appendChild(soundToggle);
  }
});

// Smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

// Add page visibility API for performance
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause animations when page is not visible
    document.querySelectorAll('.particle').forEach(p => {
      p.style.animationPlayState = 'paused';
    });
  } else {
    // Resume animations
    document.querySelectorAll('.particle').forEach(p => {
      p.style.animationPlayState = 'running';
    });
  }
});