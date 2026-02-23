/**
 * Yada Yada Yada — Mini Game
 *
 * Elaine loves to skip the details with "yada yada yada". In this game the
 * player is shown a Seinfeld quote with a key word replaced by "yada". They
 * must pick the correct missing word from four options before time runs out.
 *
 * Each developer can extend this scene independently by adding entries to
 * the QUESTIONS array at the top of this file.
 */
import Phaser from 'phaser';

const QUESTIONS = [
  {
    quote: 'I was doing great with her until we yada yada yada\'d.',
    blank: 'yada yada yada\'d',
    choices: ['kissed', 'argued', 'broke up', 'dined'],
    answer: 'broke up',
  },
  {
    quote: 'I\'m George. I\'m unemployed and I live with my yada.',
    blank: 'yada',
    choices: ['girlfriend', 'parents', 'boss', 'car'],
    answer: 'parents',
  },
  {
    quote: 'These pretzels are making me yada.',
    blank: 'yada',
    choices: ['sleepy', 'thirsty', 'angry', 'late'],
    answer: 'thirsty',
  },
  {
    quote: 'No yada for you!',
    blank: 'yada',
    choices: ['coffee', 'parking', 'soup', 'money'],
    answer: 'soup',
  },
  {
    quote: 'I\'m the master of my yada, the captain of my soul.',
    blank: 'yada',
    choices: ['ship', 'domain', 'fate', 'house'],
    answer: 'domain',
  },
  {
    quote: 'It\'s not a lie if you yada yada it.',
    blank: 'yada yada',
    choices: ['hide', 'believe', 'deny', 'spin'],
    answer: 'believe',
  },
  {
    quote: 'Hello, Newman.',
    blank: null,
    choices: ['Hi Jerry', 'Goodbye Newman', 'Hello, Newman', 'Hey Kramer'],
    answer: 'Hello, Newman',
    isFullQuote: true,
    fullQuoteQuestion: 'Jerry\'s famous greeting to Newman is:',
  },
];

const TIME_PER_QUESTION = 10000; // ms

export default class YadaYada extends Phaser.Scene {
  constructor() {
    super({ key: 'YadaYada' });
  }

  init() {
    this.score = 0;
    this.questionIndex = 0;
    this.answered = false;
    this.questions = Phaser.Utils.Array.Shuffle([...QUESTIONS]);
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0c10);

    // Title bar
    this.add.rectangle(width / 2, 40, width, 80, 0x6c3483);
    this.add
      .text(width / 2, 30, 'YADA YADA YADA', {
        fontSize: '28px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#f1c40f',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 58, 'Fill in the blank!', {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#d7bde2',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);

    // Score and progress
    this.scoreText = this.add
      .text(width - 20, 90, `Score: 0 / ${this.questions.length}`, {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#f1c40f',
      })
      .setOrigin(1, 0);

    // Timer bar
    const barW = 600;
    this.add.rectangle(width / 2, 115, barW, 14, 0x2c3e50).setStrokeStyle(1, 0x5d6d7e);
    this.timerFill = this.add
      .rectangle(width / 2 - barW / 2, 115, barW, 14, 0x8e44ad)
      .setOrigin(0, 0.5);

    // Quote area
    this.quoteText = this.add
      .text(width / 2, 200, '', {
        fontSize: '22px',
        fontFamily: 'Georgia, serif',
        color: '#ecf0f1',
        align: 'center',
        wordWrap: { width: 700 },
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    // Choice buttons (2x2 grid)
    this.choiceButtons = this.createChoiceButtons(width, height);

    // Feedback text
    this.feedbackText = this.add
      .text(width / 2, 520, '', {
        fontSize: '22px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#2ecc71',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Question timer
    this.questionTimer = this.time.addEvent({
      delay: 32,
      loop: true,
      callback: this.tickTimer,
      callbackScope: this,
    });

    this.showQuestion();
    this.createBackButton();
  }

  createChoiceButtons(width, height) {
    const cols = 2;
    const rows = 2;
    const btnW = 290;
    const btnH = 70;
    const startX = width / 2 - btnW / 2 - 10;
    const startY = 360;
    const spacingX = btnW + 20;
    const spacingY = btnH + 16;

    const buttons = [];
    for (let i = 0; i < 4; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX + btnW / 2;
      const y = startY + row * spacingY + btnH / 2;

      const bg = this.add
        .rectangle(x, y, btnW, btnH, 0x6c3483)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(x, y, '', {
          fontSize: '16px',
          fontFamily: 'Arial, sans-serif',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: btnW - 20 },
        })
        .setOrigin(0.5);

      bg.on('pointerover', () => !this.answered && bg.setFillStyle(0x9b59b6));
      bg.on('pointerout', () => !this.answered && bg.setFillStyle(0x6c3483));
      bg.on('pointerdown', () => this.handleAnswer(i));

      buttons.push({ bg, txt });
    }
    return buttons;
  }

  showQuestion() {
    if (this.questionIndex >= this.questions.length) {
      this.endGame();
      return;
    }

    this.answered = false;
    this.elapsedTime = 0;
    this.feedbackText.setText('');

    const q = this.questions[this.questionIndex];
    const display = q.isFullQuote
      ? q.fullQuoteQuestion
      : `"${q.quote.replace(q.blank, '___')}"`;
    this.quoteText.setText(display);

    // Shuffle choices for display
    const shuffled = Phaser.Utils.Array.Shuffle([...q.choices]);
    this.currentShuffledChoices = shuffled;

    this.choiceButtons.forEach(({ bg, txt }, i) => {
      txt.setText(shuffled[i] ?? '');
      bg.setFillStyle(0x6c3483);
      bg.setAlpha(1);
      i < shuffled.length ? bg.setInteractive({ useHandCursor: true }) : bg.disableInteractive();
    });

    this.scoreText.setText(`Score: ${this.score} / ${this.questions.length}`);
  }

  tickTimer() {
    if (this.answered) return;
    this.elapsedTime = (this.elapsedTime ?? 0) + 32;

    const pct = Math.max(0, 1 - this.elapsedTime / TIME_PER_QUESTION);
    const barW = 600;
    this.timerFill.setSize(barW * pct, 14);

    const color = pct > 0.5 ? 0x8e44ad : pct > 0.25 ? 0xf39c12 : 0xe74c3c;
    this.timerFill.setFillStyle(color);

    if (this.elapsedTime >= TIME_PER_QUESTION) {
      this.handleAnswer(-1); // time's up
    }
  }

  handleAnswer(choiceIndex) {
    if (this.answered) return;
    this.answered = true;

    const q = this.questions[this.questionIndex];
    const chosen = this.currentShuffledChoices[choiceIndex];
    const correct = chosen === q.answer;

    if (correct) {
      this.score++;
      this.feedbackText.setText('✅ Correct!');
      this.feedbackText.setStyle({ color: '#2ecc71' });
    } else if (choiceIndex === -1) {
      this.feedbackText.setText(`⏰ Time\'s up! Answer: "${q.answer}"`);
      this.feedbackText.setStyle({ color: '#e67e22' });
    } else {
      this.feedbackText.setText(`❌ Wrong! Answer: "${q.answer}"`);
      this.feedbackText.setStyle({ color: '#e74c3c' });
    }

    // Color the buttons
    this.choiceButtons.forEach(({ bg, txt }, i) => {
      if (i >= this.currentShuffledChoices.length) return;
      if (this.currentShuffledChoices[i] === q.answer) {
        bg.setFillStyle(0x27ae60);
      } else if (i === choiceIndex) {
        bg.setFillStyle(0xc0392b);
      } else {
        bg.setAlpha(0.4);
      }
      bg.disableInteractive();
    });

    this.scoreText.setText(`Score: ${this.score} / ${this.questions.length}`);
    this.questionIndex++;
    this.time.delayedCall(1800, () => this.showQuestion());
  }

  endGame() {
    this.questionTimer.remove();

    const { width, height } = this.scale;
    const pct = Math.round((this.score / QUESTIONS.length) * 100);
    const msg =
      pct === 100
        ? 'Perfect! You know your yadas!'
        : pct >= 70
        ? 'Pretty good! Almost Seinfeld-level.'
        : 'Yada yada yada… maybe watch more Seinfeld.';

    this.quoteText.setText(
      `Game Over!\n\nYou got ${this.score} / ${QUESTIONS.length} (${pct}%)\n\n${msg}`
    );
    this.quoteText.setStyle({ color: '#f1c40f', fontSize: '20px' });
    this.feedbackText.setText('');

    this.choiceButtons.forEach(({ bg }) => {
      bg.setFillStyle(0x2c3e50);
      bg.disableInteractive();
    });

    const restartBg = this.add
      .rectangle(width / 2, height - 80, 300, 55, 0xf1c40f)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height - 80, 'Play Again', {
        fontSize: '22px',
        fontFamily: 'Arial Black, sans-serif',
        color: '#000',
      })
      .setOrigin(0.5);
    restartBg.on('pointerdown', () => this.scene.restart());

    const menuBg = this.add
      .rectangle(width / 2, height - 20, 300, 40, 0x2c3e50)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(width / 2, height - 20, '← Main Menu', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    menuBg.on('pointerdown', () => this.scene.start('MainMenu'));
  }

  createBackButton() {
    const btn = this.add
      .text(20, 580, '← Menu', {
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        color: '#95a5a6',
      })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#95a5a6' }));
    btn.on('pointerdown', () => this.scene.start('MainMenu'));
  }
}
