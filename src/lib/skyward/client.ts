import { SkywardCourse } from '@/types';

/**
 * Skyward Client using skyward-rest package
 *
 * Canyons District Skyward URL: https://student.canyonsdistrict.org/
 * Login endpoint: https://student.canyonsdistrict.org/scripts/wsisa.dll/WService=wsEAplus/seplog01.w
 */

// Canyons District Skyward URL
const SKYWARD_BASE_URL = 'https://student.canyonsdistrict.org/scripts/wsisa.dll/WService=wsEAplus/seplog01.w';

// Define types for skyward-rest responses
interface SkywardReportCourse {
  name: string;
  instructor?: string;
  grades: Array<{
    period: string;
    score: number | null;
    letter: string | null;
  }>;
}

interface SkywardGradebookAssignment {
  name: string;
  date: string;
  pointsEarned: number | null;
  pointsTotal: number;
  category: string;
}

interface SkywardGradebookData {
  assignments: SkywardGradebookAssignment[];
  categories: Array<{
    name: string;
    weight: number;
    score: number;
  }>;
}

interface ScrapeResult<T> {
  data: T;
  raw: string;
}

// Type for the skyward-rest module
interface SkywardScraper {
  scrapeReport(user: string, pass: string): Promise<ScrapeResult<SkywardReportCourse[]>>;
  scrapeGradebook(user: string, pass: string, options: { course: number; bucket: string }): Promise<ScrapeResult<SkywardGradebookData>>;
  scrapeHistory(user: string, pass: string): Promise<ScrapeResult<unknown>>;
}

class SkywardClient {
  private skywardUrl: string;
  private scraper: SkywardScraper | null = null;

  constructor(skywardUrl?: string) {
    this.skywardUrl = skywardUrl || SKYWARD_BASE_URL;
    this.initScraper();
  }

  private initScraper() {
    try {
      // Dynamic import to avoid issues during build
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const skywardRest = require('skyward-rest');
      this.scraper = skywardRest(this.skywardUrl);
    } catch (error) {
      console.error('Failed to initialize skyward-rest:', error);
    }
  }

  /**
   * Test connection by attempting to fetch report card
   */
  async testConnection(username: string, password: string): Promise<{ success: boolean; courseCount?: number; error?: string }> {
    if (!this.scraper) {
      return { success: false, error: 'Skyward scraper not initialized' };
    }

    try {
      const result = await this.scraper.scrapeReport(username, password);
      return {
        success: true,
        courseCount: result.data?.length || 0
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Get report card with all courses and grades
   */
  async getReportCard(username: string, password: string): Promise<SkywardCourse[]> {
    if (!this.scraper) {
      throw new Error('Skyward scraper not initialized');
    }

    try {
      const result = await this.scraper.scrapeReport(username, password);

      return result.data.map((course: SkywardReportCourse) => ({
        name: course.name,
        instructor: course.instructor || 'Unknown',
        grades: course.grades.map(g => ({
          period: g.period,
          score: g.score,
          letter: g.letter
        }))
      }));
    } catch (error) {
      console.error('Failed to fetch Skyward report card:', error);
      throw error;
    }
  }

  /**
   * Get detailed gradebook for a specific course
   */
  async getGradebook(
    username: string,
    password: string,
    courseId: number,
    bucket: string
  ): Promise<{ assignments: SkywardGradebookAssignment[]; categories: Array<{ name: string; weight: number; score: number }> }> {
    if (!this.scraper) {
      throw new Error('Skyward scraper not initialized');
    }

    try {
      const result = await this.scraper.scrapeGradebook(username, password, {
        course: courseId,
        bucket: bucket
      });

      return {
        assignments: result.data.assignments || [],
        categories: result.data.categories || []
      };
    } catch (error) {
      console.error('Failed to fetch Skyward gradebook:', error);
      throw error;
    }
  }

  /**
   * Get academic history
   */
  async getHistory(username: string, password: string): Promise<unknown> {
    if (!this.scraper) {
      throw new Error('Skyward scraper not initialized');
    }

    try {
      const result = await this.scraper.scrapeHistory(username, password);
      return result.data;
    } catch (error) {
      console.error('Failed to fetch Skyward history:', error);
      throw error;
    }
  }
}

export const skywardClient = new SkywardClient();
export { SkywardClient };
