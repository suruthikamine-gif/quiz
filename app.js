/* ==========================================================================
   QuizForge AI - Client Application Logic
   ========================================================================== */

class QuizForgeApp {
  constructor() {
    this.quizzes = [];
    this.stats = {
      totalCreated: 0,
      totalTaken: 0,
      totalQuestions: 0,
      avgScore: 0
    };
    
    // Active session state
    this.currentQuiz = null;
    this.userAnswers = {}; // Mapped by question ID
    this.currentQuestionIndex = 0;
    this.timerInterval = null;
    this.secondsRemaining = 0;
    this.activeView = 'dashboard';
    
    // UI Theme state
    this.theme = 'dark';
    
    // Initialize the app
    this.init();
  }

  init() {
    this.loadState();
    this.setupTheme();
    this.registerEventListeners();
    this.renderStats();
    this.renderRecentQuizzes();
    this.renderLibrary();
    lucide.createIcons();
    
    // Expose app globally for simple HTML callbacks
    window.app = this;
  }

  // Load state from localStorage or load a default educational sample quiz
  loadState() {
    try {
      const storedQuizzes = localStorage.getItem('quizforge_quizzes');
      const storedStats = localStorage.getItem('quizforge_stats');
      const storedTheme = localStorage.getItem('quizforge_theme');
      
      if (storedTheme) {
        this.theme = storedTheme;
      }
      
      if (storedQuizzes) {
        this.quizzes = JSON.parse(storedQuizzes);
      } else {
        // Seed default sample quiz for high-end onboarding experience
        this.quizzes = [this.getSampleQuiz()];
        localStorage.setItem('quizforge_quizzes', JSON.stringify(this.quizzes));
      }

      if (storedStats) {
        this.stats = JSON.parse(storedStats);
      } else {
        this.recalculateStats();
      }
    } catch (e) {
      console.error('Error loading localStorage state', e);
      this.quizzes = [this.getSampleQuiz()];
      this.recalculateStats();
    }
  }

  saveState() {
    try {
      localStorage.setItem('quizforge_quizzes', JSON.stringify(this.quizzes));
      localStorage.setItem('quizforge_stats', JSON.stringify(this.stats));
    } catch (e) {
      console.error('Error saving state to localStorage', e);
    }
  }

  setupTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.innerHTML = this.theme === 'dark' 
        ? '<i data-lucide="sun"></i>' 
        : '<i data-lucide="moon"></i>';
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('quizforge_theme', this.theme);
    this.setupTheme();
    lucide.createIcons();
  }

  recalculateStats() {
    const takenQuizzes = this.quizzes.filter(q => q.lastScore !== undefined && q.lastScore !== null);
    const totalTaken = takenQuizzes.length;
    const totalCreated = this.quizzes.length;
    
    let totalQuestions = 0;
    this.quizzes.forEach(q => totalQuestions += q.questions ? q.questions.length : 0);
    
    let avgScore = 0;
    if (totalTaken > 0) {
      const sum = takenQuizzes.reduce((acc, q) => acc + q.lastScore, 0);
      avgScore = Math.round(sum / totalTaken);
    }

    this.stats = {
      totalCreated,
      totalTaken,
      totalQuestions,
      avgScore
    };
    this.saveState();
  }

  renderStats() {
    document.getElementById('stat-total-created').textContent = this.stats.totalCreated;
    document.getElementById('stat-total-taken').textContent = this.stats.totalTaken;
    document.getElementById('stat-avg-score').textContent = `${this.stats.avgScore}%`;
    document.getElementById('stat-questions-generated').textContent = this.stats.totalQuestions;
  }

  // Views switcher
  switchView(viewId) {
    // Hide active timer if exit from player
    if (this.activeView === 'player' && viewId !== 'player') {
      clearInterval(this.timerInterval);
    }

    // Toggle active view elements
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.remove('active');
    });
    
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList.add('active');
    }
    
    // Toggle active navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
      }
    });

    this.activeView = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Specially render lists when switching views
    if (viewId === 'dashboard') {
      this.renderRecentQuizzes();
      this.renderStats();
    } else if (viewId === 'library') {
      this.renderLibrary();
    }
    
    lucide.createIcons();
  }

  registerEventListeners() {
    // Sidebar nav clicks
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Generation Form submission
    const genForm = document.getElementById('quiz-generation-form');
    if (genForm) {
      genForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleQuizGeneration();
      });
    }

    // Quick creation Form
    const quickForm = document.getElementById('quick-create-form');
    if (quickForm) {
      quickForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = document.getElementById('quick-topic').value;
        this.handleQuickQuizGeneration(topic);
      });
    }

    // Slider label updates
    const lengthSlider = document.getElementById('quiz-length');
    const lengthVal = document.getElementById('quiz-length-val');
    if (lengthSlider && lengthVal) {
      lengthSlider.addEventListener('input', (e) => {
        lengthVal.textContent = `${e.target.value} Questions`;
      });
    }

    // Search input filters
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (this.activeView === 'library') {
          document.getElementById('library-search').value = query;
          this.renderLibrary(query);
        } else {
          // Switch to library on searching
          this.switchView('library');
          document.getElementById('library-search').value = query;
          this.renderLibrary(query);
        }
      });
    }

    const librarySearch = document.getElementById('library-search');
    if (librarySearch) {
      librarySearch.addEventListener('input', (e) => {
        this.renderLibrary(e.target.value);
      });
    }

    const librarySort = document.getElementById('library-sort');
    if (librarySort) {
      librarySort.addEventListener('change', () => {
        this.renderLibrary(document.getElementById('library-search').value);
      });
    }

    // Player controls
    document.getElementById('player-prev-btn').addEventListener('click', () => this.navigateQuestion(-1));
    document.getElementById('player-next-btn').addEventListener('click', () => this.navigateQuestion(1));
    document.getElementById('player-submit-answer-btn').addEventListener('click', () => this.submitAnswer());
    document.getElementById('player-exit-btn').addEventListener('click', () => {
      if (confirm('Are you sure you want to exit? Your current progress in this quiz will be lost.')) {
        this.switchView('dashboard');
      }
    });

    // Fitb enter key triggers submission
    document.getElementById('fitb-answer-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submitAnswer();
      }
    });

    // Results actions
    document.getElementById('results-print-btn').addEventListener('click', () => this.printQuizWorksheet());
    document.getElementById('results-share-btn').addEventListener('click', () => this.copyResultsToClipboard());
    document.getElementById('results-export-json').addEventListener('click', () => this.exportQuizAsJSON());
  }

  // Seeding default content for the user
  getSampleQuiz() {
    return {
      id: "seeded-sample-quiz",
      title: "Photosynthesis & Cellular Energy",
      description: "A comprehensive review of light-dependent reactions, the Calvin cycle, and chloroplast structure for secondary biology education.",
      subject: "Biology / Plant Sciences",
      difficulty: "High School",
      estimatedTime: 10,
      lastScore: 80, // Pre-graded to look nice in stats
      lastTakenDate: new Date(Date.now() - 86400000).toISOString(),
      questions: [
        {
          id: "q1",
          type: "multiple-choice",
          concept: "Light-absorbing pigments",
          question: "Which of the following pigments is directly responsible for converting light energy into chemical energy during photosynthesis?",
          options: [
            "Chlorophyll b",
            "Chlorophyll a",
            "Carotenoids",
            "Phycobilins"
          ],
          correctAnswer: 1,
          explanation: "Chlorophyll a is the principal pigment involved in photosynthesis. While accessory pigments like Chlorophyll b and carotenoids absorb light energy and transfer it to Chlorophyll a, only Chlorophyll a forms the reaction center which initiates chemical conversion."
        },
        {
          id: "q2",
          type: "true-false",
          concept: "Light reactions localization",
          question: "The light-dependent reactions of photosynthesis take place in the stroma of the chloroplast.",
          options: ["True", "False"],
          correctAnswer: 1,
          explanation: "False. The light-dependent reactions take place inside the thylakoid membranes where chlorophyll molecules are embedded. The stroma is the fluid-filled space where the light-independent Calvin cycle takes place."
        },
        {
          id: "q3",
          type: "fill-in-the-blank",
          concept: "Gaseous outputs",
          question: "During the light reactions, water molecules are split to release protons, electrons, and [blank] gas as a byproduct.",
          correctAnswer: "oxygen",
          explanation: "Through photolysis, water (H2O) is broken down into protons (H+), electrons (e-), and oxygen gas (O2). This oxygen is released through the stomata and serves as the primary source of atmospheric oxygen."
        },
        {
          id: "q4",
          type: "multiple-choice",
          concept: "Carbon Fixation Enzymes",
          question: "What is the key enzyme responsible for catalyzing the first step of carbon fixation in the Calvin cycle?",
          options: [
            "ATP Synthase",
            "RuBisCO",
            "PEP Carboxylase",
            "NADP+ Reductase"
          ],
          correctAnswer: 1,
          explanation: "RuBisCO (Ribulose-1,5-bisphosphate carboxylase-oxygenase) is the enzyme that incorporates gaseous CO2 into ribulose-1,5-bisphosphate (RuBP), initiating the carbon fixation process. It is considered one of the most abundant proteins on Earth."
        },
        {
          id: "q5",
          type: "true-false",
          concept: "Calvin Cycle energy requirements",
          question: "The Calvin cycle does not directly require light, but it relies on the products ATP and NADPH generated by the light reactions.",
          options: ["True", "False"],
          correctAnswer: 0,
          explanation: "True. The Calvin cycle is referred to as the light-independent reactions because light is not a direct input. However, it cannot run without the energy storing molecules ATP and the reducing agent NADPH, which are generated during the light-dependent stage."
        }
      ]
    };
  }

  // Dashboard rendering
  renderRecentQuizzes() {
    const listContainer = document.getElementById('dashboard-recent-quizzes');
    if (!listContainer) return;

    // Filter down to recent 3 quizzes
    const sorted = [...this.quizzes].sort((a, b) => {
      const dateA = a.lastTakenDate ? new Date(a.lastTakenDate) : new Date(0);
      const dateB = b.lastTakenDate ? new Date(b.lastTakenDate) : new Date(0);
      return dateB - dateA;
    });

    const recent = sorted.slice(0, 3);

    if (recent.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="file-question"></i>
          <p>No quizzes created yet. Craft your first educational resource!</p>
          <button class="btn btn-secondary btn-sm" onclick="window.app.switchView('generator')">Get Started</button>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    listContainer.innerHTML = recent.map(quiz => {
      const scoreText = quiz.lastScore !== undefined && quiz.lastScore !== null 
        ? `<span class="badge ${quiz.lastScore >= 80 ? 'badge-green' : 'badge-orange'}">${quiz.lastScore}% Score</span>` 
        : `<span class="badge badge-accent">Unplayed</span>`;
        
      return `
        <div class="stat-card" style="cursor: pointer;" onclick="window.app.startQuiz('${quiz.id}')">
          <div class="stat-icon icon-purple">
            <i data-lucide="file-text"></i>
          </div>
          <div class="stat-details" style="flex-grow: 1;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.15rem;">${quiz.title}</h4>
            <p style="font-size: 0.75rem; color: var(--text-muted);">${quiz.subject} • ${quiz.questions.length} Qs</p>
          </div>
          <div class="recent-item-right" style="text-align: right;">
            ${scoreText}
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  // Library rendering with search & filters
  renderLibrary(searchQuery = '') {
    const grid = document.getElementById('library-quizzes-grid');
    if (!grid) return;

    let filtered = [...this.quizzes];

    // Filter by query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(quiz => 
        quiz.title.toLowerCase().includes(q) || 
        quiz.subject.toLowerCase().includes(q) || 
        quiz.description.toLowerCase().includes(q)
      );
    }

    // Sort quizzes
    const sortVal = document.getElementById('library-sort').value;
    if (sortVal === 'newest') {
      // If we don't have createdDate, sort by ID (Date.now()) or default
      filtered.sort((a, b) => (b.id.toString().localeCompare(a.id.toString())));
    } else if (sortVal === 'oldest') {
      filtered.sort((a, b) => (a.id.toString().localeCompare(b.id.toString())));
    } else if (sortVal === 'alphabetical') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortVal === 'score') {
      filtered.sort((a, b) => (b.lastScore || 0) - (a.lastScore || 0));
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i data-lucide="search-code"></i>
          <p>No quizzes matches search criteria. Try another subject!</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    grid.innerHTML = filtered.map(quiz => {
      const scoreBadge = quiz.lastScore !== undefined && quiz.lastScore !== null
        ? `<span class="badge ${quiz.lastScore >= 80 ? 'badge-green' : 'badge-orange'}">Last Score: ${quiz.lastScore}%</span>`
        : `<span class="badge badge-accent">Unplayed</span>`;
        
      return `
        <div class="quiz-card">
          <button class="quiz-card-delete" onclick="event.stopPropagation(); window.app.deleteQuiz('${quiz.id}')" title="Delete Quiz">
            <i data-lucide="trash-2"></i>
          </button>
          
          <div class="quiz-card-header">
            <div>
              <span class="badge badge-accent" style="margin-bottom: 0.5rem; display: inline-block;">${quiz.difficulty}</span>
              <h3 class="quiz-card-title">${quiz.title}</h3>
            </div>
          </div>
          
          <p class="quiz-card-desc">${quiz.description}</p>
          
          <div class="quiz-card-meta">
            <div class="quiz-card-meta-left">
              <span><strong>Subject:</strong> ${quiz.subject}</span>
              <span><strong>Length:</strong> ${quiz.questions.length} Questions</span>
            </div>
            <div>
              ${scoreBadge}
            </div>
          </div>
          
          <div class="quiz-card-actions">
            <button class="btn btn-primary btn-sm" onclick="window.app.startQuiz('${quiz.id}')">
              <i data-lucide="play"></i> Take Test
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.app.viewQuizResults('${quiz.id}')" ${quiz.lastScore === undefined || quiz.lastScore === null ? 'disabled' : ''}>
              <i data-lucide="award"></i> Review
            </button>
          </div>
        </div>
      `;
    }).join('');

    lucide.createIcons();
  }

  deleteQuiz(id) {
    if (confirm('Are you sure you want to delete this quiz from your library?')) {
      this.quizzes = this.quizzes.filter(q => q.id !== id);
      localStorage.setItem('quizforge_quizzes', JSON.stringify(this.quizzes));
      this.recalculateStats();
      this.renderLibrary(document.getElementById('library-search').value);
      this.renderRecentQuizzes();
    }
  }

  // Triggered when generator form is submitted
  async handleQuizGeneration() {
    const topic = document.getElementById('quiz-topic-input').value;
    const sourceText = document.getElementById('quiz-source-text').value;
    const difficulty = document.getElementById('quiz-difficulty').value;
    const tone = document.getElementById('quiz-tone').value;
    const length = parseInt(document.getElementById('quiz-length').value);
    
    // Validate question types checked
    const typeMc = document.getElementById('qtype-mc').checked;
    const typeTf = document.getElementById('qtype-tf').checked;
    const typeFitb = document.getElementById('qtype-fitb').checked;
    
    const allowedTypes = [];
    if (typeMc) allowedTypes.push('multiple-choice');
    if (typeTf) allowedTypes.push('true-false');
    if (typeFitb) allowedTypes.push('fill-in-the-blank');

    if (allowedTypes.length === 0) {
      alert('Please check at least one question type (Multiple Choice, True/False, or Fill in the Blanks).');
      return;
    }

    // Toggle loader
    const loader = document.getElementById('generation-loader');
    const submitBtn = document.getElementById('generate-submit-btn');
    
    loader.classList.remove('hidden');
    submitBtn.disabled = true;

    const progressStep = document.getElementById('loading-progress-step');
    const progressFill = document.getElementById('loading-progress-fill');
    
    const updateProgress = (text, percent) => {
      progressStep.textContent = text;
      progressFill.style.width = `${percent}%`;
    };

    updateProgress("Structuring quiz criteria...", 15);

    // Build the AI Prompt
    const prompt = this.buildPrompt({
      topic,
      sourceText,
      difficulty,
      tone,
      length,
      allowedTypes
    });

    try {
      updateProgress("Connecting to Claude AI...", 40);
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: 4000
        })
      });

      updateProgress("Forging concepts and crafting explanations...", 75);

      const data = await response.json();
      
      if (!response.ok) {
        let errMsg = 'Server returned an error';
        if (data && data.error) {
          if (typeof data.error === 'object') {
            errMsg = data.error.message || JSON.stringify(data.error);
          } else {
            errMsg = data.error;
          }
        }
        throw new Error(errMsg);
      }

      updateProgress("Validating quiz structure...", 90);

      // Extract JSON content
      const content = data.content[0].text;
      const parsedQuiz = this.cleanAndParseJSON(content);
      
      // Inject details
      parsedQuiz.id = 'quiz_' + Date.now();
      parsedQuiz.lastScore = null;
      parsedQuiz.lastTakenDate = null;
      
      // Save to library
      this.quizzes.push(parsedQuiz);
      this.saveState();
      this.recalculateStats();
      
      // Success! Move to player
      loader.classList.add('hidden');
      submitBtn.disabled = false;
      
      // Switch view and launch quiz
      this.startQuiz(parsedQuiz.id);
      
    } catch (error) {
      console.error(error);
      loader.classList.add('hidden');
      submitBtn.disabled = false;
      alert(`Forging Failed: ${error.message}\n\nPlease check your Anthropic API Key in .env and try again.`);
    }
  }

  // Trigger quick generate from dashboard
  async handleQuickQuizGeneration(topic) {
    const loader = document.getElementById('generation-loader');
    this.switchView('generator');
    
    document.getElementById('quiz-topic-input').value = topic;
    document.getElementById('quiz-source-text').value = "";
    document.getElementById('quiz-difficulty').value = "High School";
    document.getElementById('quiz-tone').value = "Academic";
    document.getElementById('quiz-length').value = 5;
    document.getElementById('quiz-length-val').textContent = "5 Questions";
    document.getElementById('qtype-mc').checked = true;
    document.getElementById('qtype-tf').checked = true;
    document.getElementById('qtype-fitb').checked = false;

    this.handleQuizGeneration();
  }

  buildPrompt({ topic, sourceText, difficulty, tone, length, allowedTypes }) {
    const typeDescriptions = [];
    if (allowedTypes.includes('multiple-choice')) {
      typeDescriptions.push(`"multiple-choice": Question with 4 options. "options" must be an array of exactly 4 strings. "correctAnswer" must be the index (0, 1, 2, or 3) of the correct option.`);
    }
    if (allowedTypes.includes('true-false')) {
      typeDescriptions.push(`"true-false": Boolean style. "options" must be an array: ["True", "False"]. "correctAnswer" must be 0 for True or 1 for False.`);
    }
    if (allowedTypes.includes('fill-in-the-blank')) {
      typeDescriptions.push(`"fill-in-the-blank": Blank statement. The question text should contain "[blank]" where the word is missing. Do NOT provide an "options" field. "correctAnswer" must be a clean, single-word or short phrase string (e.g. "hydrogen" or "H2O").`);
    }

    return `You are an expert curriculum developer and quiz designer. Your task is to generate a comprehensive, highly accurate, and pedagogically sound quiz.

TARGET DETAILS:
- Topic / Subject: ${topic}
- Target Grade / Difficulty: ${difficulty}
- Tone / Teaching Style: ${tone}
- Number of Questions: ${length}
- Allowed Question Types: ${allowedTypes.join(', ')}

${sourceText ? `SOURCE MATERIAL REFERENCE:
Use the following text as the absolute ground truth to generate questions. Focus on testing concepts mentioned in this text:
---
${sourceText}
---` : 'Generate standard curriculum questions matching the topic.'}

JSON SCHEMA SPECIFICATIONS:
You must respond with a single, valid JSON block. The response must fit the following schema structure:
{
  "title": "A concise, engaging title for the quiz",
  "description": "A detailed 1-2 sentence description explaining what this quiz assesses",
  "subject": "${topic}",
  "difficulty": "${difficulty}",
  "estimatedTime": ${Math.ceil(length * 1.5)}, // integer estimation of time in minutes
  "questions": [
    {
      "id": "q_1",
      "type": "one of: ${allowedTypes.join(', ')}",
      "concept": "Brief phrase describing the primary concept being tested (e.g. 'Photosynthesis Enzymes')",
      "question": "The question text itself",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"], // ONLY for multiple-choice and true-false
      "correctAnswer": 0, // Integer index for options OR String for fill-in-the-blank (e.g. "answer")
      "explanation": "A complete, student-friendly explanation of why this answer is correct, explaining any necessary contextual details."
    }
  ]
}

RULES FOR QUESTION TYPES:
${typeDescriptions.map(d => `- ${d}`).join('\n')}

CRITICAL FORMATTING RULES:
1. Output ONLY the JSON block. Do not include introductory text, conversational remarks, or concluding comments.
2. Ensure the JSON is completely valid, parseable, and all strings are escaped correctly.
3. Make explanations highly educational, telling students not just what is correct but the logic/context.
4. If source material is provided, do not introduce facts not mentioned in the source material.
5. Provide a concept field for every question to help generate student analytics.

Begin generating JSON quiz:`;
  }

  // Extraction helper to pull JSON out of LLM response
  cleanAndParseJSON(rawText) {
    let clean = rawText.trim();
    
    // Remove markdown code blocks if present
    if (clean.startsWith('```')) {
      // remove beginning ```json or ```
      const matchStart = clean.match(/^```(?:json)?/i);
      if (matchStart) {
        clean = clean.slice(matchStart[0].length);
      }
      // remove trailing ```
      if (clean.endsWith('```')) {
        clean = clean.slice(0, -3);
      }
    }
    
    clean = clean.trim();
    
    // Fallback: search for first '{' and last '}'
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(clean);
  }

  // Quiz Player Sessions
  startQuiz(quizId) {
    const quiz = this.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    this.currentQuiz = quiz;
    this.userAnswers = {};
    this.currentQuestionIndex = 0;
    this.secondsRemaining = quiz.estimatedTime * 60;
    
    // Set UI metadata
    document.getElementById('player-title').textContent = quiz.title;
    document.getElementById('player-difficulty-badge').textContent = quiz.difficulty;
    document.getElementById('player-total-count').textContent = quiz.questions.length;
    
    // Start view
    this.switchView('player');
    
    // Start timer
    this.startTimer();
    
    // Render first question
    this.renderQuestion();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    const timerBox = document.getElementById('player-timer-box');
    timerBox.classList.remove('warning');
    
    const updateTimerDisplay = () => {
      const minutes = Math.floor(this.secondsRemaining / 60);
      const seconds = this.secondsRemaining % 60;
      
      document.getElementById('player-time').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
      if (this.secondsRemaining <= 60) {
        timerBox.classList.add('warning');
      }

      if (this.secondsRemaining <= 0) {
        clearInterval(this.timerInterval);
        alert("Time is up! Submitting your answers automatically.");
        this.finishQuiz();
      }
      this.secondsRemaining--;
    };

    updateTimerDisplay();
    this.timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  renderQuestion() {
    const question = this.currentQuiz.questions[this.currentQuestionIndex];
    const total = this.currentQuiz.questions.length;
    
    // Update progress elements
    document.getElementById('player-current-index').textContent = this.currentQuestionIndex + 1;
    const progressPct = ((this.currentQuestionIndex + 1) / total) * 100;
    document.getElementById('player-progress-fill').style.width = `${progressPct}%`;

    // Toggle navigation buttons state
    document.getElementById('player-prev-btn').disabled = this.currentQuestionIndex === 0;
    
    const nextBtn = document.getElementById('player-next-btn');
    if (this.currentQuestionIndex === total - 1) {
      nextBtn.innerHTML = `<span>Finish Quiz</span> <i data-lucide="award"></i>`;
    } else {
      nextBtn.innerHTML = `<span>Next Question</span> <i data-lucide="chevron-right"></i>`;
    }
    
    // Renders question content
    const typeBadge = document.getElementById('question-type-badge');
    const qText = document.getElementById('question-text');
    const answersContainer = document.getElementById('answers-container');
    const fillInContainer = document.getElementById('fill-in-container');
    
    typeBadge.textContent = this.capitalizeType(question.type);
    qText.textContent = question.question;
    
    // Reset answers
    answersContainer.innerHTML = '';
    fillInContainer.classList.add('hidden');
    
    const savedAnswer = this.userAnswers[question.id];

    if (question.type === 'multiple-choice' || question.type === 'true-false') {
      answersContainer.classList.remove('hidden');
      
      question.options.forEach((option, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C, D
        const isSelected = savedAnswer !== undefined && parseInt(savedAnswer) === idx;
        
        const btn = document.createElement('button');
        btn.className = `answer-option-btn ${isSelected ? 'selected' : ''}`;
        btn.innerHTML = `
          <span class="option-marker">${letter}</span>
          <span class="option-label-text">${option}</span>
        `;
        
        btn.addEventListener('click', () => {
          // Deselect others
          answersContainer.querySelectorAll('.answer-option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          
          this.userAnswers[question.id] = idx;
        });
        
        answersContainer.appendChild(btn);
      });
    } else if (question.type === 'fill-in-the-blank') {
      answersContainer.classList.add('hidden');
      fillInContainer.classList.remove('hidden');
      
      const fitbInput = document.getElementById('fitb-answer-input');
      fitbInput.value = savedAnswer || '';
      fitbInput.focus();
    }
    
    lucide.createIcons();
  }

  capitalizeType(type) {
    if (type === 'multiple-choice') return 'Multiple Choice';
    if (type === 'true-false') return 'True / False';
    if (type === 'fill-in-the-blank') return 'Fill In The Blanks';
    return type;
  }

  navigateQuestion(direction) {
    // Save Fill in the blanks if active
    const question = this.currentQuiz.questions[this.currentQuestionIndex];
    if (question.type === 'fill-in-the-blank') {
      const input = document.getElementById('fitb-answer-input').value;
      if (input.trim()) {
        this.userAnswers[question.id] = input.trim();
      }
    }

    const nextIndex = this.currentQuestionIndex + direction;
    
    if (nextIndex >= 0 && nextIndex < this.currentQuiz.questions.length) {
      this.currentQuestionIndex = nextIndex;
      this.renderQuestion();
    } else if (nextIndex >= this.currentQuiz.questions.length) {
      this.finishQuiz();
    }
  }

  // Answer submitting triggers checking/saving
  submitAnswer() {
    const question = this.currentQuiz.questions[this.currentQuestionIndex];
    
    if (question.type === 'fill-in-the-blank') {
      const input = document.getElementById('fitb-answer-input').value;
      if (!input.trim()) {
        alert('Please type an answer before submitting.');
        return;
      }
      this.userAnswers[question.id] = input.trim();
    } else {
      if (this.userAnswers[question.id] === undefined) {
        alert('Please select an option before submitting.');
        return;
      }
    }

    // Advance
    this.navigateQuestion(1);
  }

  // Finishes quiz session, grades, generates feedback
  finishQuiz() {
    clearInterval(this.timerInterval);
    
    // Extract any final typed input
    const question = this.currentQuiz.questions[this.currentQuestionIndex];
    if (question.type === 'fill-in-the-blank') {
      const input = document.getElementById('fitb-answer-input').value;
      if (input.trim()) {
        this.userAnswers[question.id] = input.trim();
      }
    }

    // Grade quiz
    let correctCount = 0;
    const totalCount = this.currentQuiz.questions.length;
    
    this.currentQuiz.questions.forEach(q => {
      const uAns = this.userAnswers[q.id];
      const cAns = q.correctAnswer;
      
      if (q.type === 'fill-in-the-blank') {
        if (uAns && cAns && uAns.toString().trim().toLowerCase() === cAns.toString().trim().toLowerCase()) {
          correctCount++;
        }
      } else {
        if (uAns !== undefined && parseInt(uAns) === parseInt(cAns)) {
          correctCount++;
        }
      }
    });

    const scorePct = Math.round((correctCount / totalCount) * 100);
    
    // Save to quiz object
    this.currentQuiz.lastScore = scorePct;
    this.currentQuiz.lastTakenDate = new Date().toISOString();
    this.currentQuiz.userAnswers = { ...this.userAnswers }; // Cache user answers to review later
    
    // Save to state library
    const idx = this.quizzes.findIndex(q => q.id === this.currentQuiz.id);
    if (idx !== -1) {
      this.quizzes[idx] = this.currentQuiz;
    }
    
    this.saveState();
    this.recalculateStats();

    // Trigger fireworks/confetti if they passed beautifully!
    if (scorePct >= 80) {
      this.triggerConfetti();
    }

    // Transition to results
    this.viewQuizResults(this.currentQuiz.id);
  }

  // Confetti micro-interaction
  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  // Load results page for a quiz
  viewQuizResults(quizId) {
    const quiz = this.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    this.currentQuiz = quiz;
    this.userAnswers = quiz.userAnswers || {};

    // Switch view
    this.switchView('results');

    // Header metadata
    document.getElementById('results-quiz-meta').textContent = 
      `Subject: ${quiz.subject} | Difficulty: ${quiz.difficulty} | Questions: ${quiz.questions.length}`;

    // Score radial
    const scorePct = quiz.lastScore || 0;
    const correctCount = quiz.questions.filter(q => {
      const uAns = this.userAnswers[q.id];
      if (q.type === 'fill-in-the-blank') {
        return uAns && q.correctAnswer && uAns.toString().trim().toLowerCase() === q.correctAnswer.toString().trim().toLowerCase();
      }
      return uAns !== undefined && parseInt(uAns) === parseInt(q.correctAnswer);
    }).length;
    
    document.getElementById('results-score-pct').textContent = `${scorePct}%`;
    document.getElementById('results-score-fraction').textContent = `${correctCount}/${quiz.questions.length} Correct`;

    // SVG Offset calculation
    const circle = document.getElementById('results-score-circle');
    const radius = 50;
    const circumference = 2 * Math.PI * radius; // 314.159
    const offset = circumference - (scorePct / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    // Performance tier & critique
    const tierBadge = document.getElementById('results-performance-tier');
    const critiqueText = document.getElementById('results-performance-critique');
    
    tierBadge.className = 'mastery-badge'; // Reset
    if (scorePct >= 90) {
      tierBadge.textContent = 'Elite Mastery';
      tierBadge.classList.add('badge-green');
      critiqueText.textContent = 'Excellent! You demonstrate absolute control over these educational learning concepts. You are ready to teach this topic!';
    } else if (scorePct >= 70) {
      tierBadge.textContent = 'Proficient';
      tierBadge.classList.add('badge-green');
      critiqueText.textContent = 'Good progress. You understand the foundational mechanics. Re-reading the explanations below will resolve any remaining core doubts.';
    } else if (scorePct >= 50) {
      tierBadge.textContent = 'Developing';
      tierBadge.classList.add('badge-orange');
      critiqueText.textContent = 'Some conceptual gaps remain. Review the highlighted corrections and explanations below to build your core subject understanding.';
    } else {
      tierBadge.textContent = 'Review Needed';
      tierBadge.classList.add('badge-orange');
      critiqueText.textContent = 'Struggling with these core ideas. We recommend re-generating a smaller 5-question review quiz on this subject with study guides pasted.';
    }

    // Compile recommendations
    this.compileAIRecommendations(quiz);

    // Render Review & Explanations list
    this.renderReviewList(quiz);
  }

  compileAIRecommendations(quiz) {
    const container = document.getElementById('results-recommendations');
    container.innerHTML = '';
    
    const incorrectQuestions = quiz.questions.filter(q => {
      const uAns = this.userAnswers[q.id];
      if (q.type === 'fill-in-the-blank') {
        return !uAns || !q.correctAnswer || uAns.toString().trim().toLowerCase() !== q.correctAnswer.toString().trim().toLowerCase();
      }
      return uAns === undefined || parseInt(uAns) !== parseInt(q.correctAnswer);
    });

    if (incorrectQuestions.length === 0) {
      container.innerHTML = `
        <div class="rec-item" style="border-left-color: #4ade80;">
          <i data-lucide="check-circle" style="color: #4ade80;"></i>
          <div>
            <strong>100% Correct Mastery!</strong>
            <p style="font-size: 0.75rem; margin-top: 0.2rem;">You got everything right! No remediation needed. Challenge yourself by generating a college-level quiz.</p>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // Compile concepts got wrong
    const wrongConcepts = [...new Set(incorrectQuestions.map(q => q.concept || 'General Concepts'))];
    
    container.innerHTML = wrongConcepts.map(concept => {
      return `
        <div class="rec-item">
          <i data-lucide="book-open"></i>
          <div>
            <strong>Concept Review: ${concept}</strong>
            <p style="font-size: 0.75rem; margin-top: 0.2rem;">Practice questions in this focus area were missed. Re-verify the chloroplast thylakoid structures, textbook notes, and explanations.</p>
          </div>
        </div>
      `;
    }).join('');
    
    lucide.createIcons();
  }

  renderReviewList(quiz) {
    const container = document.getElementById('results-explanations-container');
    container.innerHTML = '';

    quiz.questions.forEach((q, idx) => {
      const uAns = this.userAnswers[q.id];
      const cAns = q.correctAnswer;
      
      let isCorrect = false;
      if (q.type === 'fill-in-the-blank') {
        isCorrect = uAns && cAns && uAns.toString().trim().toLowerCase() === cAns.toString().trim().toLowerCase();
      } else {
        isCorrect = uAns !== undefined && parseInt(uAns) === parseInt(cAns);
      }

      const item = document.createElement('div');
      item.className = 'review-item';
      
      const statusIcon = isCorrect 
        ? '<i data-lucide="check-circle" class="status-correct"></i> <span class="status-correct">Correct</span>' 
        : '<i data-lucide="x-circle" class="status-incorrect"></i> <span class="status-incorrect">Incorrect</span>';
        
      item.innerHTML = `
        <div class="review-header-clickable">
          <div class="review-header-left">
            <div class="review-status-indicator">
              ${statusIcon}
              <span style="color: var(--text-muted);">• Question ${idx + 1} (${this.capitalizeType(q.type)})</span>
            </div>
            <h3 class="review-question-text">${q.question}</h3>
          </div>
          <i data-lucide="chevron-down" class="chevron-icon"></i>
        </div>
        <div class="review-body hidden">
          <!-- Render review content dynamically -->
        </div>
      `;

      const header = item.querySelector('.review-header-clickable');
      const body = item.querySelector('.review-body');

      // Expand / Collapse click handler
      header.addEventListener('click', () => {
        const isHidden = body.classList.contains('hidden');
        
        // Collapse all others
        container.querySelectorAll('.review-body').forEach(b => b.classList.add('hidden'));
        container.querySelectorAll('.review-item').forEach(ri => ri.classList.remove('expanded'));
        
        if (isHidden) {
          body.classList.remove('hidden');
          item.classList.add('expanded');
        }
      });

      // Populate body details based on question type
      if (q.type === 'multiple-choice' || q.type === 'true-false') {
        let optionsHtml = '<div class="review-options-grid">';
        q.options.forEach((opt, oIdx) => {
          const letter = String.fromCharCode(65 + oIdx);
          const isSelected = uAns !== undefined && parseInt(uAns) === oIdx;
          const isCorrectAns = parseInt(cAns) === oIdx;
          
          let optClass = '';
          if (isCorrectAns) optClass = 'correct-ans';
          else if (isSelected && !isCorrectAns) optClass = 'wrong-ans';
          
          optionsHtml += `
            <div class="review-option ${optClass}">
              <span class="review-option-marker">${letter}</span>
              <span>${opt}</span>
            </div>
          `;
        });
        optionsHtml += '</div>';
        body.innerHTML = optionsHtml;
      } else if (q.type === 'fill-in-the-blank') {
        body.innerHTML = `
          <div class="user-typed-answer">
            <span class="answer-label">Your Typed Answer:</span>
            <span class="answer-value ${isCorrect ? 'answer-correct-val' : 'answer-wrong-val'}">${uAns || 'No Answer'}</span>
          </div>
          <div class="user-typed-answer" style="border-color: rgba(22, 163, 74, 0.3);">
            <span class="answer-label" style="color: #4ade80;">Correct Answer:</span>
            <span class="answer-value answer-correct-val">${cAns}</span>
          </div>
        `;
      }

      // Add explanations
      const explanationBlock = document.createElement('div');
      explanationBlock.className = 'explanation-block';
      explanationBlock.innerHTML = `
        <h4 class="explanation-title">Educational Explanation</h4>
        <p class="explanation-text">${q.explanation}</p>
      `;
      body.appendChild(explanationBlock);

      container.appendChild(item);
    });

    lucide.createIcons();
  }

  // Worksheets printing compilation
  printQuizWorksheet() {
    if (!this.currentQuiz) return;
    const quiz = this.currentQuiz;
    const printContainer = document.getElementById('print-sheet-container');
    
    let html = `
      <div class="print-header">
        <h1 class="print-title">${quiz.title}</h1>
        <p style="text-align: center; font-style: italic; margin-bottom: 5px;">${quiz.description}</p>
        <div class="print-meta">
          <span><strong>Subject:</strong> ${quiz.subject}</span>
          <span><strong>Grade Level:</strong> ${quiz.difficulty}</span>
          <span><strong>Estimated Time:</strong> ${quiz.estimatedTime} Minutes</span>
        </div>
      </div>
      
      <div class="print-student-info">
        <div>Student Name: <span class="print-student-line"></span></div>
        <div>Date: <span class="print-student-line" style="width: 150px;"></span></div>
        <div>Score: <span class="print-student-line" style="width: 80px;"></span></div>
      </div>
      
      <div class="print-questions-section">
    `;

    quiz.questions.forEach((q, idx) => {
      html += `
        <div class="print-question-item">
          <div class="print-question-text">${idx + 1}. ${q.question}</div>
      `;

      if (q.type === 'multiple-choice' || q.type === 'true-false') {
        html += `<ul class="print-options-list">`;
        q.options.forEach((opt, oIdx) => {
          const letter = String.fromCharCode(65 + oIdx);
          html += `
            <li class="print-option-item">
              <span class="print-checkbox-box"></span>
              <strong>${letter}.</strong>&nbsp; ${opt}
            </li>
          `;
        });
        html += `</ul>`;
      } else if (q.type === 'fill-in-the-blank') {
        html += `
          <div style="margin-top: 8px; font-size: 12px;">
            Answer: <span class="print-blank-box"></span>
          </div>
        `;
      }

      html += `</div>`;
    });

    html += `</div>`; // Close print-questions-section

    // ANSWER KEY SECTION (Page-breaked)
    html += `
      <div class="print-page-break">
        <div class="print-header">
          <h1 class="print-title">${quiz.title} - ANSWER KEY</h1>
        </div>
        
        <div class="print-key-list">
    `;

    quiz.questions.forEach((q, idx) => {
      let correctDisplay = '';
      if (q.type === 'multiple-choice' || q.type === 'true-false') {
        const letter = String.fromCharCode(65 + parseInt(q.correctAnswer));
        correctDisplay = `Correct Option: ${letter} (${q.options[q.correctAnswer]})`;
      } else {
        correctDisplay = `Correct Answer: ${q.correctAnswer}`;
      }

      html += `
        <div class="print-key-item">
          <div class="print-key-question">Question ${idx + 1}: ${q.question}</div>
          <div class="print-key-correct">${correctDisplay}</div>
          <div class="print-key-explanation"><strong>Explanation:</strong> ${q.explanation}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    printContainer.innerHTML = html;
    
    // Call print
    window.print();
  }

  // Copy Results clipboard card sharing
  copyResultsToClipboard() {
    if (!this.currentQuiz) return;
    const quiz = this.currentQuiz;
    const score = quiz.lastScore || 0;
    
    let textCard = `🎓 QuizForge AI - Student Report Card\n`;
    textCard += `━━━━━━━━━━━━━━━━━━━━━\n`;
    textCard += `Quiz: ${quiz.title}\n`;
    textCard += `Subject: ${quiz.subject}\n`;
    textCard += `Grade: ${quiz.difficulty}\n`;
    textCard += `Date Taken: ${new Date(quiz.lastTakenDate).toLocaleDateString()}\n`;
    textCard += `━━━━━━━━━━━━━━━━━━━━━\n`;
    textCard += `Final Score: ${score}%\n`;
    textCard += `Assessment: ${score >= 90 ? 'Mastery' : score >= 70 ? 'Proficient' : 'Review Suggested'}\n`;
    textCard += `━━━━━━━━━━━━━━━━━━━━━\n`;
    textCard += `Generated dynamically via QuizForge AI`;

    navigator.clipboard.writeText(textCard)
      .then(() => {
        alert('Results card copied to clipboard! You can paste and share this on Slack, MS Teams, or Email.');
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  }

  // Export quiz as structural JSON file
  exportQuizAsJSON() {
    if (!this.currentQuiz) return;
    const quiz = this.currentQuiz;
    
    // Clean keys for external use
    const exportObj = {
      title: quiz.title,
      description: quiz.description,
      subject: quiz.subject,
      difficulty: quiz.difficulty,
      estimatedTime: quiz.estimatedTime,
      questions: quiz.questions.map(q => ({
        type: q.type,
        concept: q.concept,
        question: q.question,
        options: q.options || undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${quiz.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_quiz.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

// Run instantiation on content load
document.addEventListener('DOMContentLoaded', () => {
  new QuizForgeApp();
});
