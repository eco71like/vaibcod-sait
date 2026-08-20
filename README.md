# Vibe Coder — portfolio

Одностраничный сайт-портфолио: сайты, интерфейсы и digital-проекты.

## Структура

```
├── index.html          # разметка
├── styles.css          # стили
├── script.js           # анимации и интеракции
├── assets/
│   └── portrait.jpg    # фото на первом экране
├── README.md
└── .gitignore
```

## Запуск локально

Открой `index.html` в браузере — сборка не нужна.

Или через локальный сервер:

```bash
npx --yes serve .
```

## Возможности

- hero с портретом и WebGL-нитями
- появление заголовка по буквам
- BounceCards в блоке проектов (GSAP)
- параллакс, tilt-карточки, магнитные кнопки
- контакты: Telegram и VK

## Публикация на GitHub

1. Создай пустой репозиторий на [github.com/new](https://github.com/new) (без README).
2. В папке проекта:

```bash
git remote add origin https://github.com/USERNAME/vibe-coder-portfolio.git
git push -u origin main
```

## GitHub Pages

**Settings → Pages → Deploy from a branch → `main` / `/ (root)`**

Сайт: `https://USERNAME.github.io/vibe-coder-portfolio/`
