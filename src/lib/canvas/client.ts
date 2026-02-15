import { CanvasCourse, CanvasAssignment, CanvasSubmission } from '@/types';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL || 'https://canyons.instructure.com';
const CANVAS_ACCESS_TOKEN = process.env.CANVAS_ACCESS_TOKEN;

class CanvasClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(accessToken?: string) {
    this.baseUrl = CANVAS_BASE_URL;
    this.accessToken = accessToken || CANVAS_ACCESS_TOKEN || '';
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Canvas access token not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all active courses for the current user
   */
  async getCourses(): Promise<CanvasCourse[]> {
    return this.fetch<CanvasCourse[]>('/courses?enrollment_state=active&per_page=50');
  }

  /**
   * Get assignments for a specific course
   */
  async getAssignments(courseId: number): Promise<CanvasAssignment[]> {
    return this.fetch<CanvasAssignment[]>(
      `/courses/${courseId}/assignments?per_page=100&order_by=due_at`
    );
  }

  /**
   * Get all assignments across all courses
   */
  async getAllAssignments(): Promise<CanvasAssignment[]> {
    const courses = await this.getCourses();
    const assignmentPromises = courses.map(course =>
      this.getAssignments(course.id).catch(() => [])
    );
    const assignmentArrays = await Promise.all(assignmentPromises);
    return assignmentArrays.flat();
  }

  /**
   * Get upcoming assignments (due in the next N days)
   */
  async getUpcomingAssignments(days: number = 14): Promise<CanvasAssignment[]> {
    const allAssignments = await this.getAllAssignments();
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return allAssignments.filter(assignment => {
      if (!assignment.due_at) return false;
      const dueDate = new Date(assignment.due_at);
      return dueDate >= now && dueDate <= futureDate;
    }).sort((a, b) => {
      const dateA = new Date(a.due_at!).getTime();
      const dateB = new Date(b.due_at!).getTime();
      return dateA - dateB;
    });
  }

  /**
   * Get assignments that are locking soon
   */
  async getLockingSoon(days: number = 3): Promise<CanvasAssignment[]> {
    const allAssignments = await this.getAllAssignments();
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return allAssignments.filter(assignment => {
      if (!assignment.lock_at) return false;
      const lockDate = new Date(assignment.lock_at);
      return lockDate >= now && lockDate <= futureDate;
    }).sort((a, b) => {
      const dateA = new Date(a.lock_at!).getTime();
      const dateB = new Date(b.lock_at!).getTime();
      return dateA - dateB;
    });
  }

  /**
   * Get submission status for an assignment
   */
  async getSubmission(courseId: number, assignmentId: number): Promise<CanvasSubmission> {
    return this.fetch<CanvasSubmission>(
      `/courses/${courseId}/assignments/${assignmentId}/submissions/self`
    );
  }
}

export const canvasClient = new CanvasClient();
export { CanvasClient };
