# Meow Namester

Meow Namester is a web application that helps you pick the perfect cat name through a tournament style voting system. It is built with **React 19** and uses **Supabase** for data storage and authentication.

## Installation

1. Clone the repository

   ```bash
   git clone https://github.com/guitarbeat/meow-namester-react.git
   cd meow-namester-react
   ```
2. Install dependencies

   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Supabase credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in:

   ```env
   REACT_APP_SUPABASE_URL=your-supabase-url
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Start the development server

   ```bash
   npm start
   ```

The app will be available at `http://localhost:3000`.

## Usage

- Visit the site and log in with a name to save your results.
- Select several cat names to enter into the tournament.
- Vote in the head‑to‑head matchups until a winner emerges.
- View your results and statistics in the profile section.

## Requirements

- Node.js 18 or newer is recommended.
- The following environment variables are required:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`

If additional packages are missing, run `npm install` to ensure all dependencies from `package.json` are installed.

## License

Use of this project requires express permission from the author. See the
[LICENSE](LICENSE) file for details on requesting permission.

## Linting

Run ESLint on the JavaScript and JSX files:

```bash
npm run lint:js
```

Run Stylelint on the CSS files:

```bash
npm run lint:css
```

## Testing

Run the unit tests with:

```bash
npm test
```

The React testing environment starts in watch mode. Press `q` to quit.

## Production Build

Create an optimized build for deployment:

```bash
npm run build
```

The compiled app will be written to the `build` directory.

## Documentation

More detailed project documentation lives in the `memory-bank` directory. These files describe the overall design, technical context and development progress.
