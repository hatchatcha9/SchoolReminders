import puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const SKYWARD_LOGIN_URL = 'https://student.canyonsdistrict.org/scripts/wsisa.dll/WService=wsEAplus/seplog01.w';

interface QuarterGrade {
  quarter: string;
  letter: string | null;
  isCurrent: boolean;
}

interface MissingAssignment {
  name: string;
  course: string;
  teacher: string;
  dueDate: string;
}

interface SkywardCourse {
  name: string;
  period: string;
  teacher: string;
  grades: QuarterGrade[];
}

interface ScrapeResult {
  success: boolean;
  courses?: SkywardCourse[];
  missingAssignments?: MissingAssignment[];
  studentName?: string;
  school?: string;
  error?: string;
}

interface CourseDetails {
  courseName: string;
  teacher: string;
  period: string;
  currentGrade: string | null;
  currentScore: number | null;
  assignments: Array<{
    name: string;
    category: string;
    score: number | null;
    pointsPossible: number | null;
    missing: boolean;
    late: boolean;
    dueDate: string | null;
  }>;
  categories: Array<{
    name: string;
    weight: number;
    earnedPoints: number;
    possiblePoints: number;
    currentScore: number | null;
  }>;
}

interface CourseDetailsResult {
  success: boolean;
  courseDetails?: CourseDetails;
  error?: string;
}

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SkywardPuppeteerClient {
  private browser: Browser | null = null;
  private debugMode = true; // Set to true to save screenshots
  private isOperationInProgress = false;
  private operationQueue: Array<() => void> = [];

  private async waitForTurn(): Promise<void> {
    if (!this.isOperationInProgress) {
      this.isOperationInProgress = true;
      return;
    }

    // Wait for current operation to finish
    return new Promise((resolve) => {
      this.operationQueue.push(() => {
        this.isOperationInProgress = true;
        resolve();
      });
    });
  }

  private releaseTurn(): void {
    this.isOperationInProgress = false;
    const next = this.operationQueue.shift();
    if (next) {
      next();
    }
  }

  async init(): Promise<void> {
    // Check if browser exists and is still connected
    if (this.browser) {
      try {
        // Test if browser is still connected
        await this.browser.version();
        return; // Browser is good, no need to reinitialize
      } catch {
        // Browser was closed, reset it
        this.browser = null;
      }
    }

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: false, // Visible mode required - Skyward detects headless browsers
        protocolTimeout: 120000, // 2 minute timeout for protocol operations
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1366,768'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      });
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    await this.init();
    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }
    return this.browser;
  }

  private async setupPage(page: Page): Promise<void> {
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });

    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Remove automation indicators
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Add chrome property
      (window as unknown as { chrome: object }).chrome = { runtime: {} };

      // Add plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Add languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async saveDebugScreenshot(page: Page, name: string): Promise<void> {
    if (this.debugMode) {
      try {
        const debugDir = path.join(process.cwd(), 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        await page.screenshot({ path: path.join(debugDir, `${name}.png`), fullPage: true });
        console.log(`Debug screenshot saved: ${name}.png`);
      } catch (e) {
        console.error('Failed to save screenshot:', e);
      }
    }
  }

  async testConnection(username: string, password: string): Promise<{ success: boolean; message?: string; error?: string }> {
    let page: Page | null = null;

    try {
      const browser = await this.ensureBrowser();
      page = await browser.newPage();

      // Set up page to avoid detection
      await this.setupPage(page);

      // Set a reasonable viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate to login page
      console.log('Navigating to Skyward login page...');
      await page.goto(SKYWARD_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      await this.saveDebugScreenshot(page, '01-login-page');

      // Log the page content to see what we're working with
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);

      // Try multiple possible selectors for the login form
      const usernameSelectors = [
        'input[name="login"]',
        'input[id="login"]',
        'input[name="username"]',
        'input[type="text"]',
        '#login',
        'input.login'
      ];

      const passwordSelectors = [
        'input[name="password"]',
        'input[id="password"]',
        'input[type="password"]',
        '#password'
      ];

      let usernameField = null;
      let passwordField = null;

      // Find username field
      for (const selector of usernameSelectors) {
        usernameField = await page.$(selector);
        if (usernameField) {
          console.log('Found username field with selector:', selector);
          break;
        }
      }

      // Find password field
      for (const selector of passwordSelectors) {
        passwordField = await page.$(selector);
        if (passwordField) {
          console.log('Found password field with selector:', selector);
          break;
        }
      }

      if (!usernameField || !passwordField) {
        // Save screenshot for debugging
        await this.saveDebugScreenshot(page, '02-no-form-found');

        // Log page HTML for debugging
        const html = await page.content();
        console.log('Page HTML (first 2000 chars):', html.substring(0, 2000));

        await page.close();
        return {
          success: false,
          error: 'Could not find login form. The Skyward page structure may have changed.'
        };
      }

      // Clear and fill the fields
      await usernameField.click({ clickCount: 3 }); // Select all
      await usernameField.type(username);

      await passwordField.click({ clickCount: 3 }); // Select all
      await passwordField.type(password);

      await this.saveDebugScreenshot(page, '03-filled-form');

      // Find and click submit button
      const submitSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value="Sign In"]',
        'input[value="Login"]',
        '#bLogin',
        'button'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = await page.$(selector);
        if (submitButton) {
          console.log('Found submit button with selector:', selector);
          break;
        }
      }

      if (!submitButton) {
        await this.saveDebugScreenshot(page, '04-no-submit-found');
        await page.close();
        return { success: false, error: 'Could not find login button' };
      }

      // Click submit and wait for navigation
      console.log('Clicking submit button...');
      await submitButton.click();

      // Wait for login to process
      console.log('Waiting for login to complete...');
      await delay(5000); // Wait for any redirects/new windows

      // Check if a new page/window was opened (Skyward sometimes does this)
      if (!this.browser) throw new Error('Browser was closed unexpectedly');
      const pages = await this.browser.pages();
      console.log(`Number of pages open: ${pages.length}`);

      // If there are multiple pages, switch to the newest one
      if (pages.length > 1) {
        page = pages[pages.length - 1]; // Get the last (newest) page
        await page.bringToFront();
        console.log('Switched to new page');
        await delay(2000);
      }

      await this.saveDebugScreenshot(page, '05-after-submit');

      // Check if we're on a logged-in page
      const finalUrl = page.url();
      const finalTitle = await page.title();
      console.log('Final URL:', finalUrl);
      console.log('Final page title:', finalTitle);

      // Check if login form is still present (login failed)
      const loginFormPresent = await page.evaluate(() => {
        return !!document.querySelector('input[name="login"]');
      });

      // Check if we see logged-in content
      const hasLoggedInContent = await page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('gradebook') ||
               bodyText.includes('my students') ||
               bodyText.includes('attendance') ||
               bodyText.includes('message center') ||
               bodyText.includes('log out') ||
               bodyText.includes('logout');
      });

      console.log('Login form present:', loginFormPresent);
      console.log('Has logged-in content:', hasLoggedInContent);

      // If we have multiple pages or logged-in content, success!
      if (!this.browser) throw new Error('Browser was closed unexpectedly');
      const allPages = await this.browser.pages();
      if (allPages.length > 1 || hasLoggedInContent || !loginFormPresent) {
        console.log('Login successful!');
        // Close all pages
        for (const p of allPages) {
          await p.close().catch(() => {});
        }
        return { success: true, message: 'Connected successfully!' };
      }

      // If we're still on login page with form visible, login failed
      if (loginFormPresent && !hasLoggedInContent) {
        await page.close();
        return {
          success: false,
          error: 'Login failed. Please double-check your username and password.'
        };
      }

      // Check for error messages on the page
      const pageContent = await page.content();
      const lowerContent = pageContent.toLowerCase();

      if (lowerContent.includes('invalid') ||
          lowerContent.includes('incorrect') ||
          lowerContent.includes('failed') ||
          lowerContent.includes('error')) {

        // Try to extract specific error message
        const errorText = await page.evaluate(() => {
          const errorEl = document.querySelector('.error, .errorMessage, [class*="error"], [id*="error"]');
          return errorEl?.textContent?.trim() || null;
        });

        await page.close();
        return {
          success: false,
          error: errorText || 'Login failed. Please check your credentials.'
        };
      }

      // If URL changed away from login page, we're probably logged in
      if (!finalUrl.includes('seplog') && !finalUrl.includes('login')) {
        await page.close();
        return { success: true, message: 'Connected successfully!' };
      }

      // Check if we're on a different page (sometimes Skyward keeps similar URLs)
      const hasGradeContent = await page.evaluate(() => {
        const body = document.body.innerText.toLowerCase();
        return body.includes('gradebook') || body.includes('my classes') || body.includes('welcome');
      });

      if (hasGradeContent) {
        await page.close();
        return { success: true, message: 'Connected successfully!' };
      }

      await page.close();
      return { success: false, error: 'Login may have failed. Please verify your credentials.' };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Skyward connection error:', error);
      if (page) {
        await this.saveDebugScreenshot(page, '99-error');
        await page.close();
      }
      return { success: false, error: `Connection failed: ${message}` };
    }
  }

  async scrapeGrades(username: string, password: string): Promise<ScrapeResult> {
    let page: Page | null = null;

    // Wait for any ongoing operation to finish
    await this.waitForTurn();

    try {
      const browser = await this.ensureBrowser();
      page = await browser.newPage();

      // Set up page to avoid detection
      await this.setupPage(page);
      await page.setViewport({ width: 1280, height: 800 });

      // Login first
      console.log('Logging into Skyward...');
      await page.goto(SKYWARD_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      // Find and fill login form
      const usernameField = await page.$('input[name="login"], input[type="text"]');
      const passwordField = await page.$('input[name="password"], input[type="password"]');

      if (!usernameField || !passwordField) {
        await page.close();
        return { success: false, error: 'Could not find login form' };
      }

      await usernameField.type(username);
      await passwordField.type(password);

      const submitButton = await page.$('#bLogin, input[type="submit"], button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
      }

      // Wait for login to process - Skyward opens a new window
      // Listen for new pages/popups
      const newPagePromise = new Promise<Page>((resolve) => {
        if (!this.browser) return;
        this.browser.once('targetcreated', async (target) => {
          const newPage = await target.page();
          if (newPage) resolve(newPage);
        });
      });

      // Wait for either a new page or timeout
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      const popupPage = await Promise.race([newPagePromise, timeoutPromise]);

      if (popupPage) {
        console.log('New popup window detected');
        page = popupPage;
        await this.setupPage(page);
        await page.bringToFront();
      }

      await delay(3000);

      // Re-check all pages and find the one with actual content (not login page)
      if (!this.browser) throw new Error('Browser was closed unexpectedly');
      const allPages = await this.browser.pages();
      console.log(`Number of pages after login: ${allPages.length}`);

      for (let i = allPages.length - 1; i >= 0; i--) {
        const p = allPages[i];
        try {
          const url = p.url();
          console.log(`Page ${i} URL: ${url}`);

          // Check if this page has logged-in content
          const hasContent = await p.evaluate(() => {
            const text = document.body?.innerText?.toLowerCase() || '';
            return text.includes('gradebook') ||
                   text.includes('home') ||
                   text.includes('message center') ||
                   text.includes('my students') ||
                   text.includes('attendance');
          }).catch(() => false);

          if (hasContent || (!url.includes('seplog') && url.includes('wsisa'))) {
            page = p;
            await page.bringToFront();
            console.log('Switched to logged-in page:', url);
            break;
          }
        } catch {
          // Page might be closed, skip it
          continue;
        }
      }

      await delay(2000);
      await this.saveDebugScreenshot(page, 'grades-01-after-login').catch(() => {});

      // Now we should be on the Skyward home page - look for Gradebook link
      console.log('Looking for Gradebook link...');
      let currentUrl = '';
      try {
        currentUrl = page.url();
        console.log('Current URL:', currentUrl);
      } catch {
        console.log('Could not get current URL, page may be detached');
      }

      // Go directly to Gradebook
      console.log('Navigating to Gradebook...');
      try {
        const clickedGradebook = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const text = link.textContent?.toLowerCase() || '';
            const href = link.href?.toLowerCase() || '';
            if (text.includes('gradebook') || href.includes('gradebook')) {
              link.click();
              return true;
            }
          }
          return false;
        });

        if (clickedGradebook && this.browser) {
          console.log('Clicked on gradebook link, waiting...');
          await delay(3000);

          const currentPages = await this.browser.pages();
          for (let i = currentPages.length - 1; i >= 0; i--) {
            try {
              const url = currentPages[i].url();
              if (url.includes('gradebook') || url.includes('sfgradebook')) {
                page = currentPages[i];
                await page.bringToFront();
                console.log('Switched to gradebook page:', url);
                break;
              }
            } catch {
              continue;
            }
          }
        }
      } catch (evalError) {
        console.log('Error navigating to gradebook:', evalError);
      }

      await delay(2000);

      // Wait for grades to load - Skyward loads them via AJAX
      console.log('Waiting for grades to load...');

      // Try clicking GPA link which often shows a popup with actual grades
      console.log('Trying to click GPA link to get grades...');
      try {
        const clickedGPA = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const link of links) {
            const text = link.textContent?.trim() || '';
            if (text === 'GPA' || text.includes('GPA')) {
              // Find the GPA link that's NOT for Online school
              const parentText = link.parentElement?.textContent || '';
              if (!parentText.includes('ONLINE')) {
                link.click();
                return true;
              }
            }
          }
          return false;
        });

        if (clickedGPA) {
          console.log('Clicked GPA link, waiting for popup...');
          await delay(3000);

          // Check if a modal/popup appeared with grades
          const gpaData = await page.evaluate(() => {
            // Look for modal or popup content
            const bodyText = document.body.innerText;
            const gradeMatches = bodyText.match(/[A-F][+-]?\s/g);
            return {
              hasGrades: (gradeMatches?.length || 0) > 5,
              text: bodyText.substring(0, 500)
            };
          });
          console.log('After GPA click - has grades:', gpaData.hasGrades);

          // Take screenshot of GPA popup
          await this.saveDebugScreenshot(page, 'grades-gpa-popup').catch(() => {});
        }
      } catch (e) {
        console.log('Could not click GPA link:', e);
      }

      // Simulate user interaction to trigger AJAX loading
      try {
        // Move mouse around to simulate user activity
        await page.mouse.move(400, 300);
        await delay(500);
        await page.mouse.move(600, 400);
        await delay(500);

        // Scroll down to trigger lazy loading
        await page.evaluate(() => window.scrollBy(0, 200));
        await delay(1000);
      } catch (e) {
        console.log('Could not interact with page:', e);
      }

      // Wait for grades to load - with stealth plugin, AJAX should work better
      console.log('Waiting for grades to load (with stealth)...');
      try {
        await page.waitForFunction(() => {
          const bodyText = document.body.innerText;
          const stillLoading = bodyText.includes('Loading...');
          const hasQuarterHeaders = bodyText.includes('Q1') && bodyText.includes('Q2');
          return !stillLoading && hasQuarterHeaders;
        }, { timeout: 45000 }); // Longer timeout with stealth
        console.log('Grades fully loaded!');
      } catch {
        console.log('Timeout waiting for grades after 45s');

        // Check if still loading
        const stillLoading = await page.evaluate(() => document.body.innerText.includes('Loading...')).catch(() => false);
        console.log('Still shows Loading...:', stillLoading);

        if (stillLoading) {
          // One more attempt - wait an extra 15 seconds
          console.log('Waiting additional 15 seconds...');
          await delay(15000);
        }
      }

      // Extra wait to ensure content is rendered
      await delay(3000);

      await this.saveDebugScreenshot(page, 'grades-02-gradebook').catch(() => {});

      // Log page content for debugging
      let pageTitle = '';
      try {
        pageTitle = await page.title();
        console.log('Gradebook page title:', pageTitle);
      } catch {
        console.log('Could not get page title');
      }

      // Debug: dump table structure
      try {
        const tableDebug = await page.evaluate(() => {
          const tables = document.querySelectorAll('table');
          const info: string[] = [];
          info.push(`Found ${tables.length} tables`);

          tables.forEach((table, idx) => {
            const rows = table.querySelectorAll('tr');
            const firstRowText = rows[0]?.textContent?.substring(0, 100) || 'empty';
            info.push(`Table ${idx}: ${rows.length} rows, first row: ${firstRowText}`);

            // Check for Q1 header - this is likely the grades table
            if (table.textContent?.includes('Q1') && table.textContent?.includes('Q2')) {
              info.push(`  -> Table ${idx} contains Q1 and Q2 - GRADES TABLE!`);
              // Log ALL rows to understand structure
              for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td, th');
                const cellTexts = Array.from(cells).map(c => {
                  const text = c.textContent?.trim().substring(0, 30) || '-';
                  return text;
                });
                info.push(`  Row ${i} (${cells.length} cells): ${cellTexts.join(' | ')}`);
              }
            }
          });

          // Also look for any cells containing grade letters
          const allCells = document.querySelectorAll('td');
          const gradeCells: string[] = [];
          allCells.forEach(cell => {
            const text = cell.textContent?.trim() || '';
            if (text.match(/^[A-F][+-]?$/)) {
              gradeCells.push(text);
            }
          });
          info.push(`Found ${gradeCells.length} cells with grade letters: ${gradeCells.slice(0, 20).join(', ')}`);

          // Dump body text to look for grade patterns
          const bodyText = document.body.innerText;
          const gradeMatches = bodyText.match(/[A-F][+-]?\s*(Q[1-4]|Period)/gi);
          info.push(`Grade patterns in body: ${gradeMatches?.slice(0, 10).join(', ') || 'none'}`);

          // Check if there's still a Loading indicator
          info.push(`Still loading: ${bodyText.includes('Loading...')}`);

          // Look for percentage grades (like 95%, 87%)
          const percentMatches = bodyText.match(/\d{1,3}%/g);
          info.push(`Percentage grades found: ${percentMatches?.slice(0, 10).join(', ') || 'none'}`);

          // Check for iframes
          const iframes = document.querySelectorAll('iframe');
          info.push(`Found ${iframes.length} iframes`);

          return info.join('\n');
        });
        console.log('Table debug:\n' + tableDebug);
      } catch (debugError) {
        console.log('Could not debug tables, page may have navigated:', debugError);
        // Try to recover page reference again
        if (!this.browser) throw new Error('Browser was closed unexpectedly');
        const recoveryPages = await this.browser.pages();
        for (let i = recoveryPages.length - 1; i >= 0; i--) {
          try {
            const url = recoveryPages[i].url();
            if (url.includes('gradebook') || url.includes('sfgradebook') || (!url.includes('seplog') && url.includes('wsisa'))) {
              page = recoveryPages[i];
              await page.bringToFront();
              console.log('Recovered page for extraction:', url);
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // Extract grades - wrap in try-catch to handle page close errors
      let gradesData;
      try {
        gradesData = await this.extractGradesData(page);
        console.log(`Found ${gradesData.courses.length} courses, ${gradesData.missingAssignments.length} missing assignments`);
      } catch (extractError) {
        console.error('Extraction error:', extractError);
        gradesData = { courses: [], missingAssignments: [], studentName: '', school: '' };
      }

      // Close browser (not just pages) to clean up properly
      try {
        await this.browser?.close();
        this.browser = null;
      } catch {}

      // If no courses found with grades, the extraction didn't work
      // But we may have found course tables without grades - return those with N/A
      if (gradesData.courses.length === 0) {
        console.log('No courses with grades found, checking for course tables without grades...');

        // Try one more extraction to get just course names
        const fallbackData = await page.evaluate(() => {
          const courses: Array<{
            name: string;
            period: string;
            teacher: string;
            grades: Array<{ quarter: string; letter: string | null; isCurrent: boolean }>;
          }> = [];

          const tables = document.querySelectorAll('table');
          for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length !== 3) continue;

            const firstRowText = rows[0]?.textContent?.trim() || '';
            const secondRowText = rows[1]?.textContent?.trim() || '';
            const thirdRowText = rows[2]?.textContent?.trim() || '';

            if (firstRowText.match(/^[A-Z][A-Z\s\d]+$/) &&
                secondRowText.match(/Period\s*\d+/i) &&
                thirdRowText.match(/^[A-Z][A-Z\s]+$/)) {
              courses.push({
                name: firstRowText,
                period: secondRowText,
                teacher: thirdRowText,
                grades: [
                  { quarter: 'Q1', letter: null, isCurrent: false },
                  { quarter: 'Q2', letter: null, isCurrent: false },
                  { quarter: 'Q3', letter: null, isCurrent: true },
                  { quarter: 'Q4', letter: null, isCurrent: false }
                ]
              });
            }
          }
          return courses;
        }).catch(() => []);

        console.log(`Fallback found ${fallbackData.length} courses without grades`);

        if (fallbackData.length > 0) {
          return {
            success: true,
            courses: fallbackData,
            missingAssignments: gradesData.missingAssignments,
            studentName: gradesData.studentName,
            school: gradesData.school
          };
        }

        return { success: false, error: 'No grades found. Skyward may be blocking automated access. Try accessing Skyward directly.' };
      }

      return {
        success: true,
        courses: gradesData.courses,
        missingAssignments: gradesData.missingAssignments,
        studentName: gradesData.studentName,
        school: gradesData.school
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Scrape error:', error);

      // Close browser on error
      try {
        await this.browser?.close();
        this.browser = null;
      } catch {}

      return { success: false, error: `Failed to scrape grades: ${message}` };
    } finally {
      this.releaseTurn();
    }
  }

  async scrapeCourseDetails(username: string, password: string, courseName: string): Promise<CourseDetailsResult> {
    let page: Page | null = null;

    // Wait for any ongoing operation to finish
    await this.waitForTurn();

    try {
      const browser = await this.ensureBrowser();
      page = await browser.newPage();

      // Set up page to avoid detection
      await this.setupPage(page);
      await page.setViewport({ width: 1280, height: 800 });

      // Login first
      console.log('Logging into Skyward for course details...');
      await page.goto(SKYWARD_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });

      // Find and fill login form
      const usernameField = await page.$('input[name="login"], input[type="text"]');
      const passwordField = await page.$('input[name="password"], input[type="password"]');

      if (!usernameField || !passwordField) {
        await page.close();
        return { success: false, error: 'Could not find login form' };
      }

      await usernameField.type(username);
      await passwordField.type(password);

      const submitButton = await page.$('#bLogin, input[type="submit"], button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
      }

      // Wait for login to process - Skyward opens a new window
      const newPagePromise = new Promise<Page>((resolve) => {
        if (!this.browser) return;
        this.browser.once('targetcreated', async (target) => {
          const newPage = await target.page();
          if (newPage) resolve(newPage);
        });
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      const popupPage = await Promise.race([newPagePromise, timeoutPromise]);

      if (popupPage) {
        console.log('New popup window detected');
        page = popupPage;
        await this.setupPage(page);
        await page.bringToFront();
      }

      await delay(3000);

      // Re-check all pages and find the one with actual content
      if (!this.browser) throw new Error('Browser was closed unexpectedly');
      const allPages = await this.browser.pages();
      for (let i = allPages.length - 1; i >= 0; i--) {
        try {
          const url = allPages[i].url();
          const hasContent = await allPages[i].evaluate(() => {
            const text = document.body?.innerText?.toLowerCase() || '';
            return text.includes('gradebook') || text.includes('home') || text.includes('message center');
          }).catch(() => false);

          if (hasContent || (!url.includes('seplog') && url.includes('wsisa'))) {
            page = allPages[i];
            await page.bringToFront();
            break;
          }
        } catch {
          continue;
        }
      }

      await delay(2000);

      // Navigate to Gradebook
      console.log('Navigating to Gradebook...');
      try {
        const clickedGradebook = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const text = link.textContent?.toLowerCase() || '';
            const href = link.href?.toLowerCase() || '';
            if (text.includes('gradebook') || href.includes('gradebook')) {
              link.click();
              return true;
            }
          }
          return false;
        });

        if (clickedGradebook && this.browser) {
          await delay(3000);
          const currentPages = await this.browser.pages();
          for (let i = currentPages.length - 1; i >= 0; i--) {
            try {
              const url = currentPages[i].url();
              if (url.includes('gradebook') || url.includes('sfgradebook')) {
                page = currentPages[i];
                await page.bringToFront();
                break;
              }
            } catch {
              continue;
            }
          }
        }
      } catch (evalError) {
        console.log('Error navigating to gradebook:', evalError);
      }

      await delay(2000);

      // Wait for grades to load
      try {
        await page.waitForFunction(() => {
          const bodyText = document.body.innerText;
          const stillLoading = bodyText.includes('Loading...');
          const hasQuarterHeaders = bodyText.includes('Q1') && bodyText.includes('Q2');
          return !stillLoading && hasQuarterHeaders;
        }, { timeout: 45000 });
      } catch {
        console.log('Timeout waiting for gradebook');
      }

      await delay(2000);

      // Extract course details directly from the gradebook page
      // (Skyward doesn't have easy-to-navigate individual course pages)
      console.log(`Extracting details for course: ${courseName}`);
      const decodedCourseName = decodeURIComponent(courseName);

      await this.saveDebugScreenshot(page, 'course-details').catch(() => {});

      // Extract course details from the gradebook page
      const courseDetails = await this.extractCourseDetailsFromGradebook(page, decodedCourseName);

      // Close browser
      try {
        await this.browser?.close();
        this.browser = null;
      } catch {}

      return {
        success: true,
        courseDetails
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Course details scrape error:', error);

      try {
        await this.browser?.close();
        this.browser = null;
      } catch {}

      return { success: false, error: `Failed to scrape course details: ${message}` };
    } finally {
      this.releaseTurn();
    }
  }

  private async extractCourseDetailsFromGradebook(page: Page, courseName: string): Promise<CourseDetails> {
    try {
      const data = await page.evaluate((targetCourse: string) => {
        const result: {
          courseName: string;
          teacher: string;
          period: string;
          currentGrade: string | null;
          currentScore: number | null;
          assignments: Array<{
            name: string;
            category: string;
            score: number | null;
            pointsPossible: number | null;
            missing: boolean;
            late: boolean;
            dueDate: string | null;
          }>;
          categories: Array<{
            name: string;
            weight: number;
            earnedPoints: number;
            possiblePoints: number;
            currentScore: number | null;
          }>;
        } = {
          courseName: targetCourse,
          teacher: '',
          period: '',
          currentGrade: null,
          currentScore: null,
          assignments: [],
          categories: []
        };

        // Find the course table on the gradebook page
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          if (rows.length === 3) {
            const firstRowText = rows[0]?.textContent?.trim() || '';
            // Check if this is the course we're looking for
            if (firstRowText.toLowerCase().includes(targetCourse.toLowerCase().substring(0, 10)) ||
                targetCourse.toLowerCase().includes(firstRowText.toLowerCase().substring(0, 10))) {
              result.courseName = firstRowText;
              result.period = rows[1]?.textContent?.trim() || '';
              result.teacher = rows[2]?.textContent?.trim() || '';
              break;
            }
          }
        }

        // Find the current grade from the grades table
        // Look for grade cells that are on the same row as the course
        const allCells = document.querySelectorAll('td');
        for (const cell of allCells) {
          const text = cell.textContent?.trim() || '';
          // Look for grade letter that might be highlighted (current quarter)
          if (text.match(/^[A-F][+-]?$/) && cell.closest('tr')) {
            const row = cell.closest('tr');
            const rowText = row?.textContent || '';
            if (rowText.toLowerCase().includes(targetCourse.toLowerCase().substring(0, 8))) {
              // Check if this cell has the current quarter highlight
              const style = window.getComputedStyle(cell);
              const bg = style.backgroundColor;
              // Yellow highlight typically indicates current quarter
              if (bg.includes('255') && bg.includes('255') && !bg.includes('255, 255, 255')) {
                result.currentGrade = text;
                break;
              }
              // If no highlight found yet, use the last grade letter found
              if (!result.currentGrade) {
                result.currentGrade = text;
              }
            }
          }
        }

        // Since Skyward doesn't easily expose individual assignments on the gradebook page,
        // we'll return empty arrays and note that detailed data requires manual access
        // The UI will show a message about this

        return result;
      }, courseName);

      return data;
    } catch (error) {
      console.error('Error extracting course details from gradebook:', error);
      return {
        courseName,
        teacher: '',
        period: '',
        currentGrade: null,
        currentScore: null,
        assignments: [],
        categories: []
      };
    }
  }

  private async extractCourseDetails(page: Page, courseName: string): Promise<CourseDetails> {
    try {
      const data = await page.evaluate((targetCourse: string) => {
        const result: {
          courseName: string;
          teacher: string;
          period: string;
          currentGrade: string | null;
          currentScore: number | null;
          assignments: Array<{
            name: string;
            category: string;
            score: number | null;
            pointsPossible: number | null;
            missing: boolean;
            late: boolean;
            dueDate: string | null;
          }>;
          categories: Array<{
            name: string;
            weight: number;
            earnedPoints: number;
            possiblePoints: number;
            currentScore: number | null;
          }>;
        } = {
          courseName: targetCourse,
          teacher: '',
          period: '',
          currentGrade: null,
          currentScore: null,
          assignments: [],
          categories: []
        };

        const bodyText = document.body.innerText;

        // Try to extract assignments from any visible table
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const headerRow = table.querySelector('tr');
          const headerText = headerRow?.textContent?.toLowerCase() || '';

          // Look for assignment tables (columns like Assignment, Score, Points, Due Date, etc.)
          if (headerText.includes('assignment') || headerText.includes('score') ||
              headerText.includes('points') || headerText.includes('grade')) {

            const rows = table.querySelectorAll('tr');
            const headerCells = headerRow?.querySelectorAll('th, td') || [];

            // Map column indices
            const columns: Record<string, number> = {};
            headerCells.forEach((cell, idx) => {
              const text = cell.textContent?.toLowerCase().trim() || '';
              if (text.includes('assignment') || text.includes('name')) columns.name = idx;
              if (text.includes('category')) columns.category = idx;
              if (text.includes('score') || text.includes('grade')) columns.score = idx;
              if (text.includes('points') && !text.includes('earned')) columns.points = idx;
              if (text.includes('due')) columns.due = idx;
              if (text.includes('status')) columns.status = idx;
            });

            // If no name column found, assume first column is name
            if (columns.name === undefined) columns.name = 0;

            for (let i = 1; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td');
              if (cells.length < 2) continue;

              const name = cells[columns.name]?.textContent?.trim() || '';
              if (!name || name.length < 2) continue;

              // Extract score
              let score: number | null = null;
              let pointsPossible: number | null = null;

              if (columns.score !== undefined && cells[columns.score]) {
                const scoreText = cells[columns.score].textContent?.trim() || '';
                const scoreMatch = scoreText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
                if (scoreMatch) {
                  score = parseFloat(scoreMatch[1]);
                  pointsPossible = parseFloat(scoreMatch[2]);
                } else {
                  const numMatch = scoreText.match(/(\d+(?:\.\d+)?)/);
                  if (numMatch) score = parseFloat(numMatch[1]);
                }
              }

              if (columns.points !== undefined && cells[columns.points] && pointsPossible === null) {
                const pointsText = cells[columns.points].textContent?.trim() || '';
                const numMatch = pointsText.match(/(\d+(?:\.\d+)?)/);
                if (numMatch) pointsPossible = parseFloat(numMatch[1]);
              }

              // Extract category
              const category = columns.category !== undefined
                ? cells[columns.category]?.textContent?.trim() || 'Uncategorized'
                : 'Uncategorized';

              // Extract due date
              const dueDate = columns.due !== undefined
                ? cells[columns.due]?.textContent?.trim() || null
                : null;

              // Check for missing/late status
              const rowText = rows[i].textContent?.toLowerCase() || '';
              const missing = rowText.includes('missing') || rowText.includes('not submitted');
              const late = rowText.includes('late');

              result.assignments.push({
                name,
                category,
                score,
                pointsPossible,
                missing,
                late,
                dueDate
              });
            }
          }

          // Look for category weights table
          if (headerText.includes('category') && (headerText.includes('weight') || headerText.includes('%'))) {
            const rows = table.querySelectorAll('tr');
            for (let i = 1; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td');
              if (cells.length < 2) continue;

              const catName = cells[0]?.textContent?.trim() || '';
              if (!catName) continue;

              // Find weight percentage
              let weight = 0;
              let earnedPoints = 0;
              let possiblePoints = 0;

              for (let j = 1; j < cells.length; j++) {
                const cellText = cells[j].textContent?.trim() || '';
                const percentMatch = cellText.match(/(\d+(?:\.\d+)?)\s*%/);
                if (percentMatch && weight === 0) {
                  weight = parseFloat(percentMatch[1]);
                }
                const pointsMatch = cellText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
                if (pointsMatch) {
                  earnedPoints = parseFloat(pointsMatch[1]);
                  possiblePoints = parseFloat(pointsMatch[2]);
                }
              }

              if (weight > 0 || earnedPoints > 0) {
                result.categories.push({
                  name: catName,
                  weight,
                  earnedPoints,
                  possiblePoints,
                  currentScore: possiblePoints > 0 ? (earnedPoints / possiblePoints) * 100 : null
                });
              }
            }
          }
        }

        // Try to extract current grade from page
        const gradeMatch = bodyText.match(/(?:current|overall)?\s*grade[:\s]*([A-F][+-]?)/i);
        if (gradeMatch) {
          result.currentGrade = gradeMatch[1];
        }

        const scoreMatch = bodyText.match(/(?:current|overall)?\s*(?:grade|score)[:\s]*(\d+(?:\.\d+)?)\s*%/i);
        if (scoreMatch) {
          result.currentScore = parseFloat(scoreMatch[1]);
        }

        // Look for course info (teacher, period) in course tables
        const courseTables = document.querySelectorAll('table');
        for (const table of courseTables) {
          const rows = table.querySelectorAll('tr');
          if (rows.length === 3) {
            const firstRowText = rows[0]?.textContent?.trim() || '';
            if (firstRowText.toLowerCase().includes(targetCourse.toLowerCase().substring(0, 10))) {
              result.period = rows[1]?.textContent?.trim() || '';
              result.teacher = rows[2]?.textContent?.trim() || '';
              break;
            }
          }
        }

        return result;
      }, courseName);

      return data;
    } catch (error) {
      console.error('Error extracting course details:', error);
      return {
        courseName,
        teacher: '',
        period: '',
        currentGrade: null,
        currentScore: null,
        assignments: [],
        categories: []
      };
    }
  }

  private async extractGradesData(page: Page): Promise<{ courses: SkywardCourse[]; missingAssignments: MissingAssignment[]; studentName: string; school: string }> {
    try {
      const data = await page.evaluate(() => {
        const results: {
          courses: Array<{
            name: string;
            period: string;
            teacher: string;
            grades: Array<{ quarter: string; letter: string | null; isCurrent: boolean }>;
          }>;
          missingAssignments: Array<{
            name: string;
            course: string;
            teacher: string;
            dueDate: string;
          }>;
          studentName: string;
          school: string;
          debug: string[];
        } = {
          courses: [],
          missingAssignments: [],
          studentName: '',
          school: '',
          debug: []
        };

        const bodyText = document.body.innerText;

        // Extract student name
        const nameMatch = bodyText.match(/([A-Z]+\s+[A-Z]\.?\s+[A-Z]+)/);
        if (nameMatch) {
          results.studentName = nameMatch[0];
        }

        // Extract school
        const schoolMatch = bodyText.match(/\(([^)]*(?:CANYON|HIGH)[^)]*)\)/i);
        if (schoolMatch) {
          results.school = schoolMatch[1];
        }

        // Missing assignments extraction disabled - the previous regex was incorrectly
        // matching regular assignments with due dates, not actual missing assignments.
        // TODO: Implement proper missing assignment detection by looking for Skyward's
        // specific "Missing" indicator or navigating to a dedicated missing work section.

        // STRATEGY 1: Look for a table with Q1, Q2, Q3, Q4 headers (standard gradebook format)
        const tables = document.querySelectorAll('table');
        results.debug.push(`Checking ${tables.length} tables for grades`);

        for (const table of tables) {
          const headerRow = table.querySelector('tr');
          const headerText = headerRow?.textContent || '';

          // Check if this table has quarter headers
          if (headerText.includes('Q1') && headerText.includes('Q2')) {
            results.debug.push('Found table with Q1/Q2 headers');

            // Find the header cells to determine column positions
            const headerCells = headerRow?.querySelectorAll('th, td') || [];
            const quarterColumns: Record<string, number> = {};
            let courseColumn = -1;

            headerCells.forEach((cell, idx) => {
              const text = cell.textContent?.trim() || '';
              if (text.includes('Q1')) quarterColumns['Q1'] = idx;
              if (text.includes('Q2')) quarterColumns['Q2'] = idx;
              if (text.includes('Q3')) quarterColumns['Q3'] = idx;
              if (text.includes('Q4')) quarterColumns['Q4'] = idx;
              if (text.toLowerCase().includes('course') || text.toLowerCase().includes('class')) {
                courseColumn = idx;
              }
            });

            results.debug.push(`Quarter columns: Q1=${quarterColumns['Q1']}, Q2=${quarterColumns['Q2']}, Q3=${quarterColumns['Q3']}, Q4=${quarterColumns['Q4']}, course=${courseColumn}`);

            const rows = table.querySelectorAll('tr');
            results.debug.push(`Table has ${rows.length} rows`);

            for (let i = 1; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('th, td');
              if (cells.length < 2) continue;

              // Get course name from first column or identified course column
              const courseIdx = courseColumn >= 0 ? courseColumn : 0;
              const courseName = cells[courseIdx]?.textContent?.trim().replace(/\s+/g, ' ') || '';

              // Skip if it doesn't look like a course name
              if (!courseName || courseName.length < 3 || courseName.match(/^(Q[1-4]|Grade|Period|Teacher|Total|Average)$/i)) {
                continue;
              }

              // Extract grades from the identified quarter columns
              const grades: Array<{ quarter: string; letter: string | null; isCurrent: boolean }> = [];
              const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

              for (const q of quarters) {
                const colIdx = quarterColumns[q];
                let letter: string | null = null;

                if (colIdx !== undefined && colIdx < cells.length) {
                  const cellText = (cells[colIdx]?.textContent?.trim() || '').replace(/[°\s]/g, '');
                  const gradeMatch = cellText.match(/([A-F][+-]?)/);
                  if (gradeMatch) {
                    letter = gradeMatch[1];
                  }
                }

                grades.push({
                  quarter: q,
                  letter,
                  isCurrent: q === 'Q3' // Assume Q3 is current
                });
              }

              // Only add if we found at least one grade
              const hasGrades = grades.some(g => g.letter !== null);
              if (hasGrades) {
                results.debug.push(`Found course: ${courseName} with grades: ${grades.filter(g => g.letter).map(g => `${g.quarter}:${g.letter}`).join(', ')}`);
                results.courses.push({
                  name: courseName,
                  period: '',
                  teacher: '',
                  grades
                });
              }
            }
          }
        }

        // If we found courses with strategy 1, return
        if (results.courses.length > 0) {
          results.debug.push(`Strategy 1 found ${results.courses.length} courses`);
          return results;
        }

        // STRATEGY 2: Look for Academic History format (Course | Grade | Credits pattern)
        results.debug.push('Trying Strategy 2: Academic History format');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const rowText = row.textContent || '';

            // Look for rows that have a course name and a grade letter
            if (cells.length >= 2) {
              const firstCell = cells[0]?.textContent?.trim() || '';
              // Check if first cell looks like a course name (has letters and possibly numbers)
              if (firstCell.match(/^[A-Z][A-Za-z\s\d]+$/) && firstCell.length > 5) {
                // Look for a grade in subsequent cells
                for (let i = 1; i < cells.length; i++) {
                  const cellText = cells[i]?.textContent?.trim() || '';
                  const gradeMatch = cellText.match(/^([A-F][+-]?)$/);
                  if (gradeMatch) {
                    results.debug.push(`Found course: ${firstCell} with grade: ${gradeMatch[1]}`);
                    results.courses.push({
                      name: firstCell,
                      period: '',
                      teacher: '',
                      grades: [
                        { quarter: 'Q1', letter: null, isCurrent: false },
                        { quarter: 'Q2', letter: null, isCurrent: false },
                        { quarter: 'Q3', letter: gradeMatch[1], isCurrent: true },
                        { quarter: 'Q4', letter: null, isCurrent: false }
                      ]
                    });
                    break;
                  }
                }
              }
            }
          }
        }

        if (results.courses.length > 0) {
          results.debug.push(`Strategy 2 found ${results.courses.length} courses`);
          return results;
        }

        // STRATEGY 3: Look for course sections with grades using column alignment
        results.debug.push('Trying Strategy 3: Course sections with column-aligned grades');

        // First, find the Q1/Q2/Q3/Q4 column header positions from the header table
        const quarterXPositions: Record<string, number> = {};
        for (const table of tables) {
          const headerRow = table.querySelector('tr');
          const headerText = headerRow?.textContent || '';
          if (headerText.includes('Q1') && headerText.includes('Q2')) {
            const cells = headerRow?.querySelectorAll('th, td') || [];
            cells.forEach(cell => {
              const text = cell.textContent?.trim() || '';
              const rect = (cell as HTMLElement).getBoundingClientRect();
              if (text.includes('Q1')) quarterXPositions['Q1'] = rect.left + rect.width / 2;
              if (text.includes('Q2')) quarterXPositions['Q2'] = rect.left + rect.width / 2;
              if (text.includes('Q3')) quarterXPositions['Q3'] = rect.left + rect.width / 2;
              if (text.includes('Q4')) quarterXPositions['Q4'] = rect.left + rect.width / 2;
            });
            break;
          }
        }
        results.debug.push(`Quarter X positions: Q1=${quarterXPositions['Q1']?.toFixed(0)}, Q2=${quarterXPositions['Q2']?.toFixed(0)}, Q3=${quarterXPositions['Q3']?.toFixed(0)}, Q4=${quarterXPositions['Q4']?.toFixed(0)}`);

        // Find all grade cells on the page with their positions
        const allGradeCells: Array<{ text: string; element: Element; y: number; x: number; centerX: number }> = [];
        document.querySelectorAll('td').forEach(cell => {
          const text = (cell.textContent?.trim() || '').replace(/[°\s]/g, '');
          if (text.match(/^[A-F][+-]?$/)) {
            const rect = (cell as HTMLElement).getBoundingClientRect();
            allGradeCells.push({
              text: text.toUpperCase(),
              element: cell,
              y: rect.top,
              x: rect.left,
              centerX: rect.left + rect.width / 2
            });
          }
        });
        results.debug.push(`Found ${allGradeCells.length} grade cells on page`);

        // Find course tables (3-row format with name, period, teacher)
        const courseData: Array<{ name: string; period: string; teacher: string; element: Element; y: number }> = [];

        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          if (rows.length !== 3) continue;

          const firstRowText = rows[0]?.textContent?.trim() || '';
          const secondRowText = rows[1]?.textContent?.trim() || '';
          const thirdRowText = rows[2]?.textContent?.trim() || '';

          if (firstRowText.match(/^[A-Z][A-Z\s\d]+$/) &&
              secondRowText.match(/Period\s*\d+/i) &&
              thirdRowText.match(/^[A-Z][A-Z\s]+$/)) {
            const rect = table.getBoundingClientRect();
            courseData.push({
              name: firstRowText,
              period: secondRowText,
              teacher: thirdRowText,
              element: table,
              y: rect.top
            });
          }
        }

        // Keep all course instances (don't deduplicate - same class in different periods should show separately)
        results.debug.push(`Found ${courseData.length} course tables`);

        // For each course, find grade cells that are:
        // 1. On the same row (tight 40px vertical tolerance)
        // 2. Aligned with the Q1/Q2/Q3/Q4 column headers (within 30px horizontally)
        for (const course of courseData) {
          const courseY = course.y;

          // Find grade cells on the same row (tight tolerance)
          const rowCells = allGradeCells.filter(cell => Math.abs(cell.y - courseY) < 40);

          // Match grades to quarters based on X position alignment
          const gradeValues: Record<string, string | null> = { Q1: null, Q2: null, Q3: null, Q4: null };
          let currentQuarter: string | null = null;

          for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
            const quarterX = quarterXPositions[quarter];
            if (quarterX === undefined) continue;

            // Find a grade cell aligned with this quarter's column (within 30px)
            const matchingCell = rowCells.find(cell => Math.abs(cell.centerX - quarterX) < 30);
            if (matchingCell) {
              gradeValues[quarter] = matchingCell.text;
              // Check if highlighted (current quarter)
              const style = window.getComputedStyle(matchingCell.element as HTMLElement);
              const bg = style.backgroundColor;
              if (bg.includes('255') && bg.includes('255') && !bg.includes('255, 255, 255')) {
                currentQuarter = quarter;
              }
            }
          }

          // If no quarter positions found, fall back to taking rightmost 4 cells
          if (Object.values(quarterXPositions).every(x => x === undefined)) {
            const sortedCells = rowCells.sort((a, b) => a.x - b.x).slice(-4);
            if (sortedCells[0]) gradeValues['Q1'] = sortedCells[0].text;
            if (sortedCells[1]) gradeValues['Q2'] = sortedCells[1].text;
            if (sortedCells[2]) gradeValues['Q3'] = sortedCells[2].text;
            if (sortedCells[3]) gradeValues['Q4'] = sortedCells[3].text;
          }

          const grades = [
            { quarter: 'Q1', letter: gradeValues['Q1'], isCurrent: currentQuarter === 'Q1' },
            { quarter: 'Q2', letter: gradeValues['Q2'], isCurrent: currentQuarter === 'Q2' },
            { quarter: 'Q3', letter: gradeValues['Q3'], isCurrent: currentQuarter === 'Q3' || currentQuarter === null },
            { quarter: 'Q4', letter: gradeValues['Q4'], isCurrent: currentQuarter === 'Q4' },
          ];

          // Log what grades were found
          const foundGrades = grades.filter(g => g.letter).map(g => `${g.quarter}:${g.letter}`).join(', ');
          results.debug.push(`Course ${course.name} (${course.period}): ${foundGrades || 'no grades'}`);

          // Check if we already have this course (by name) - if so, merge grades
          const existingCourse = results.courses.find(c => c.name === course.name);
          if (existingCourse) {
            // Merge grades - take non-null grades from this instance
            for (let i = 0; i < 4; i++) {
              if (grades[i].letter && !existingCourse.grades[i].letter) {
                existingCourse.grades[i].letter = grades[i].letter;
              }
              if (grades[i].isCurrent) {
                existingCourse.grades[i].isCurrent = true;
              }
            }
            results.debug.push(`  -> Merged into existing ${course.name}`);
          } else {
            results.courses.push({
              name: course.name,
              period: course.period,
              teacher: course.teacher,
              grades
            });
          }
        }

        results.debug.push(`Strategy 3 found ${results.courses.length} courses (after merging)`);
        return results;
      });

      console.log(`Extracted ${data.courses.length} courses, ${data.missingAssignments.length} missing assignments`);
      if (data.debug) {
        console.log('Extraction debug:', data.debug.join('\n'));
      }
      // Remove debug from returned data
      const { debug, ...cleanData } = data;
      return cleanData;
    } catch (error) {
      console.error('Error extracting grades:', error);
      return { courses: [], missingAssignments: [], studentName: '', school: '' };
    }
  }
}

// Singleton instance
let clientInstance: SkywardPuppeteerClient | null = null;

export function getSkywardClient(): SkywardPuppeteerClient {
  if (!clientInstance) {
    clientInstance = new SkywardPuppeteerClient();
  }
  return clientInstance;
}
