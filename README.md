# School Reminder

A web application that helps students stay organized by integrating with Canvas LMS and Skyward, providing smart reminders and a unified dashboard for assignments and grades.

## Features

- **Canvas Integration** - Automatically syncs assignments, due dates, and grades from Canvas LMS
- **Skyward Integration** - Connects to Skyward for grades and class schedules
- **Smart Reminders** - Get notified about upcoming assignments and tests
- **Locking Alerts** - Warnings when assignments are about to lock
- **Dashboard** - Daily overview with priority-based task organization
- **Calendar View** - Visual calendar with filtering and sorting options
- **Grade Tracking** - View grades from both Canvas and Skyward in one place

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Canvas LMS account with API access
- (Optional) Skyward student account

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd school-reminder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   # Canvas API Configuration
   CANVAS_BASE_URL=https://your-school.instructure.com

   # AI API (optional - for AI features)
   # ANTHROPIC_API_KEY=your_key_here
   # OPENAI_API_KEY=your_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Connecting Canvas

1. Go to **Settings** in the app
2. Click on the **Canvas** tab
3. Follow the instructions to get your Canvas API token:
   - Go to your Canvas Settings page
   - Scroll to "Approved Integrations"
   - Click "+ New Access Token"
   - Name it "School Reminder" and generate
   - Copy the token and paste it in the app
4. Click **Test Connection** to verify
5. Click **Save Connection**

### Connecting Skyward (Optional)

1. Go to **Settings** in the app
2. Click on the **Skyward** tab
3. Enter your Skyward username and password
4. Click **Test Connection** to verify
5. Click **Save Connection**

Note: Skyward credentials are stored locally on your device.

## Usage

### Dashboard

The dashboard shows:
- Quick stats (assignments due, urgent items, tests/quizzes)
- Daily overview with AI-generated summary (requires AI API)
- Upcoming assignments sorted by priority
- Quick reminders for items due soon

### Calendar

- View assignments on a monthly calendar
- Filter by type (test, quiz, assignment)
- Filter by course or status
- Sort by due date, course, or priority
- Toggle between calendar and list view

### Grades

- View current grades from Canvas
- See Skyward grades if connected
- Track missing assignments
- Calculate hypothetical grade changes

### Notifications

- Enable browser notifications for reminders
- Configure reminder timing:
  - 24 hours before due
  - 6 hours before due
  - 1 hour before due
  - When assignments are about to lock
- Set quiet hours to pause notifications

## Project Structure

```
school-reminder/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/               # API routes
│   │   │   ├── canvas/        # Canvas API endpoints
│   │   │   ├── skyward/       # Skyward API endpoints
│   │   │   └── ai/            # AI feature endpoints
│   │   ├── calendar/          # Calendar page
│   │   ├── grades/            # Grades page
│   │   └── setup/             # Settings page
│   ├── components/            # React components
│   │   ├── dashboard/         # Dashboard components
│   │   ├── layout/            # Layout components
│   │   ├── notifications/     # Notification components
│   │   └── reminders/         # Reminder alert components
│   ├── hooks/                 # Custom React hooks
│   └── lib/                   # Utility libraries
│       ├── cache.ts           # Data caching
│       ├── notifications.ts   # Browser notifications
│       ├── sync/              # Data synchronization
│       ├── canvas/            # Canvas API client
│       └── skyward/           # Skyward integration
├── public/                    # Static assets
└── package.json
```

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React hooks + localStorage
- **API Integration:** Canvas REST API, Skyward web scraping

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CANVAS_BASE_URL` | Your school's Canvas URL | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features | No |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No |

### Canvas Token Permissions

The Canvas API token needs access to:
- Courses
- Assignments
- Submissions
- Grades

## Troubleshooting

### Canvas Connection Issues

- Verify your token is correct and hasn't expired
- Check that your school's Canvas URL is correct
- Ensure you have student access to the courses

### Notifications Not Working

1. Check browser notification permissions
2. Verify notifications are enabled in Windows/macOS settings
3. Make sure the browser isn't blocking notifications
4. Try testing in an incognito window

### Skyward Connection Issues

- Skyward integration uses web scraping which may break if Skyward updates
- Some schools may have different Skyward configurations
- Contact support if your school's Skyward isn't working

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## License

This project is for educational purposes.

## Acknowledgments

- Canvas LMS API Documentation
- Next.js team for the excellent framework
- Tailwind CSS for styling utilities
