import { Injectable } from '@nestjs/common';
import { CourseEntity } from '../courses/course.entity';
import { CourseService } from '../courses/course.service';
import { SearchCoursesQueryDto } from './dto/search-courses-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  PostSearchHit,
  SearchResults,
  UserSearchHit,
} from './interfaces/search.interface';

/** Defensive cap on page size. */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

@Injectable()
export class SearchService {
  constructor(private readonly courseService: CourseService) {}

  /** In-memory fixture sets (bounded). */
  private readonly users: UserSearchHit[] = [
    { id: 'user-0001', username: 'rustmaster', displayName: 'Rust Master' },
    { id: 'user-0002', username: 'codewarrior', displayName: 'Code Warrior' },
    { id: 'user-0003', username: 'stellar-learner', displayName: 'Stellar Learner' },
    { id: 'user-0004', username: 'soroban-tutor', displayName: 'Soroban Tutor' },
    { id: 'user-0005', username: 'blockdash-dev', displayName: 'BlockDash Dev' },
    { id: 'user-0006', username: 'rustacean', displayName: 'Rustacean' },
    { id: 'user-0007', username: 'memorieslock', displayName: 'MemoriesLock' },
    { id: 'user-0008', username: 'rust-newbie', displayName: 'Rust Newbie' },
  ];

  private readonly posts: PostSearchHit[] = [
    {
      id: 'post-001',
      title: 'My first Soroban contract',
      body: 'Building helloworld on Stellar is fun.',
    },
    {
      id: 'post-002',
      title: 'Rust lifetime annotations explained',
      body: 'A clear walkthrough of the borrow checker.',
    },
    {
      id: 'post-003',
      title: 'Stellar path payments in 2026',
      body: 'New path-finding APIs and best practices.',
    },
    {
      id: 'post-004',
      title: 'Onboarding for new Rust learners',
      body: 'What the Rust Academy cohort should do first.',
    },
    {
      id: 'post-005',
      title: 'Memo on stellar transactions',
      body: 'How text memos are encoded and limits.',
    },
  ];

  /**
   * Paginate and filter items with relevance scoring.
   */
  private paginate<T>(
    items: T[],
    q: string | undefined,
    limit: number | undefined,
    offset: number | undefined,
    matchFields: (item: T) => string,
    scorer?: (item: T, query: string) => number,
  ): SearchResults<T> {
    const rawLimit = Number(limit);
    const effectiveLimit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const effectiveOffset = Math.max(0, Number(offset) || 0);
    const needle = (q || '').toLowerCase().trim();

    let matched: T[];
    if (needle) {
      // Score and filter items based on relevance
      const scored = items
        .map((item) => ({
          item,
          score: scorer ? scorer(item, needle) : this.defaultScore(item, needle, matchFields),
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);
      matched = scored.map((s) => s.item);
    } else {
      matched = items;
    }

    const total = matched.length;
    const page = matched.slice(effectiveOffset, effectiveOffset + effectiveLimit);
    const hasMore = effectiveOffset + page.length < total;

    const response: SearchResults<T> = {
      entries: page,
      total,
      hasMore,
    };
    if (hasMore) {
      response.nextOffset = effectiveOffset + page.length;
    }
    return response;
  }

  /** Default relevance scoring: exact match > prefix > substring. */
  private defaultScore<T>(item: T, query: string, matchFields: (item: T) => string): number {
    const text = matchFields(item).toLowerCase();
    if (text === query) return 100;
    if (text.startsWith(query)) return 50;
    if (text.includes(query)) return 25;
    return 0;
  }

  searchUsers(query: SearchQueryDto): SearchResults<UserSearchHit> {
    return this.paginate(
      this.users,
      query.q,
      query.limit,
      query.offset,
      (u) => `${u.username} ${u.displayName}`,
      (u, q) => {
        const uname = u.username.toLowerCase();
        const dname = u.displayName.toLowerCase();
        if (uname === q || dname === q) return 100;
        if (uname.startsWith(q) || dname.startsWith(q)) return 60;
        if (uname.includes(q) || dname.includes(q)) return 30;
        return 0;
      },
    );
  }

  async searchCourses(
    query: SearchCoursesQueryDto,
  ): Promise<SearchResults<CourseEntity>> {
    const courses = await this.courseService.findAll();
    const tags = this.normalize([...(query.tag ?? []), ...(query.tags ?? [])]);
    const categories = this.normalize([
      ...(query.category ?? []),
      ...(query.categories ?? []),
    ]);
    const match = query.match ?? 'any';

    const filteredCourses =
      tags.length === 0 && categories.length === 0
        ? courses
        : courses.filter((course) => {
            const courseTags = this.normalize(course.tags);
            const courseCategories = this.normalize(
              [course.category, ...(course.categories ?? [])].filter(
                (c): c is string => c != null,
              ),
            );
            const checks = [
              ...tags.map((tag) => courseTags.includes(tag)),
              ...categories.map((category) =>
                courseCategories.includes(category),
              ),
            ];
            return match === 'all'
              ? checks.every(Boolean)
              : checks.some(Boolean);
          });

    return this.paginate(
      filteredCourses,
      query.q,
      query.limit,
      query.offset,
      (c) =>
        [
          c.id,
          c.title,
          c.description,
          c.category,
          ...(c.categories ?? []),
          ...(c.tags ?? []),
        ].join(' '),
      (c, q) => {
        const title = c.title.toLowerCase();
        if (title === q) return 100;
        if (title.startsWith(q)) return 70;
        if (title.includes(q)) return 40;
        const desc = (c.description || '').toLowerCase();
        if (desc.includes(q)) return 15;
        return 0;
      },
    );
  }

  searchPosts(query: SearchQueryDto): SearchResults<PostSearchHit> {
    return this.paginate(
      this.posts,
      query.q,
      query.limit,
      query.offset,
      (p) => `${p.title} ${p.body}`,
      (p, q) => {
        const title = p.title.toLowerCase();
        const body = p.body.toLowerCase();
        if (title === q) return 100;
        if (title.startsWith(q)) return 70;
        if (title.includes(q)) return 40;
        if (body.includes(q)) return 15;
        return 0;
      },
    );
  }

  private normalize(values?: string[]): string[] {
    return (values ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }
}
