import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { AppConfigService } from '../config';
import {
    SupabaseError,
    SupabaseNetworkError,
    SupabaseUniqueConstraintError,
} from './supabase.errors';
import { createClient } from '@supabase/supabase-js';

// Mock the supabase-js module
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

describe('SupabaseService', () => {
    let service: SupabaseService;
    let mockSupabaseClient: Record<string, jest.Mock>;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockSupabaseClient = {
            from: jest.fn().mockReturnThis(),
            insert: jest.fn(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
        };

        (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SupabaseService,
                {
                    provide: AppConfigService,
                    useValue: {
                        supabaseUrl: 'http://localhost:54321',
                        supabaseAnonKey: 'some-anon-key',
                    },
                },
            ],
        }).compile();

        service = module.get<SupabaseService>(SupabaseService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
        expect(createClient).toHaveBeenCalledWith(
            'http://localhost:54321',
            'some-anon-key',
            expect.objectContaining({ auth: { persistSession: false } })
        );
    });

    describe('insertUsername', () => {
        it('should insert a username successfully', async () => {
            mockSupabaseClient.insert.mockResolvedValue({ error: null });

            await expect(service.insertUsername('alice', 'pubkey')).resolves.not.toThrow();

            expect(mockSupabaseClient.from).toHaveBeenCalledWith('usernames');
            expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
                username: 'alice',
                public_key: 'pubkey',
            });
        });

        it('should throw SupabaseUniqueConstraintError on 23505', async () => {
            mockSupabaseClient.insert.mockResolvedValue({
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            });

            await expect(service.insertUsername('alice', 'pubkey')).rejects.toThrow(SupabaseUniqueConstraintError);
        });

        it('should throw SupabaseNetworkError on fetch issue', async () => {
            mockSupabaseClient.insert.mockResolvedValue({
                error: { message: 'fetch failed' },
            });

            await expect(service.insertUsername('alice', 'pubkey')).rejects.toThrow(SupabaseNetworkError);
        });

        it('should throw SupabaseError on unknown issue', async () => {
            mockSupabaseClient.insert.mockResolvedValue({
                error: { message: 'some other error', code: '123' },
            });

            await expect(service.insertUsername('alice', 'pubkey')).rejects.toThrow(SupabaseError);
        });
    });

    describe('countUsernamesByPublicKey', () => {
        it('should return count successfully', async () => {
            mockSupabaseClient.eq.mockResolvedValue({ count: 5, error: null });

            const result = await service.countUsernamesByPublicKey('pubkey');

            expect(result).toBe(5);
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('usernames');
            expect(mockSupabaseClient.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
            expect(mockSupabaseClient.eq).toHaveBeenCalledWith('public_key', 'pubkey');
        });

        it('should throw SupabaseNetworkError on PGRST301', async () => {
            mockSupabaseClient.eq.mockResolvedValue({
                error: { code: 'PGRST301', message: 'JWT expired' },
            });

            await expect(service.countUsernamesByPublicKey('pubkey')).rejects.toThrow(SupabaseNetworkError);
        });
    });

    describe('listUsernamesByPublicKey', () => {
        it('should return list of usernames successfully', async () => {
            const mockData = [{ id: '1', username: 'alice' }];
            mockSupabaseClient.order.mockResolvedValue({ data: mockData, error: null });

            const result = await service.listUsernamesByPublicKey('pubkey');

            expect(result).toEqual(mockData);
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('usernames');
            expect(mockSupabaseClient.select).toHaveBeenCalledWith('id, username, public_key, created_at');
            expect(mockSupabaseClient.eq).toHaveBeenCalledWith('public_key', 'pubkey');
            expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: true });
        });
    });

    describe('checkHealth', () => {
        it('should return true if query succeeds', async () => {
            mockSupabaseClient.limit.mockResolvedValue({ error: null });

            const result = await service.checkHealth();

            expect(result).toBe(true);
            expect(mockSupabaseClient.from).toHaveBeenCalledWith('usernames');
            expect(mockSupabaseClient.select).toHaveBeenCalledWith('id');
            expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
        });

        it('should return false if query fails', async () => {
            mockSupabaseClient.limit.mockResolvedValue({ error: { message: 'db error' } });

            const result = await service.checkHealth();

            expect(result).toBe(false);
        });

        it('should return false if query throws exception', async () => {
            mockSupabaseClient.limit.mockRejectedValue(new Error('Network error'));

            const result = await service.checkHealth();

            expect(result).toBe(false);
        });
    });

    describe('getPaidPaymentsTotals', () => {
        it('should sum across multiple pages of paid rows', async () => {
            // Page 1 must be full (PAGE_SIZE = 1000) to trigger a second page.
            const fullPage = Array.from({ length: 1000 }, () => ({
                amount: '1',
            }));
            const lastPage = [{ amount: '2' }];
            const pages = [fullPage, lastPage];

            // Count query: from().select(cols, {head:true}).eq() resolves count.
            const countChain = {
                eq: jest.fn().mockResolvedValue({ count: 1001, error: null }),
            };
            // Paged queries: from().select().eq().range() resolves the page.
            const pagedChain = {
                eq: jest.fn().mockReturnThis(),
                range: jest.fn().mockImplementation(() => {
                    const page = pages.shift();
                    if (page === undefined) {
                        throw new Error('pages array exhausted unexpectedly');
                    }
                    return Promise.resolve({ data: page, error: null });
                }),
            };

            mockSupabaseClient.from.mockImplementation(() => ({
                select: jest.fn().mockImplementation((_cols, opts) =>
                    opts?.head ? countChain : pagedChain,
                ),
                eq: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
            }));

            const result = await service.getPaidPaymentsTotals();

            expect(pagedChain.range).toHaveBeenCalled();
            expect(result.count).toBe(1001);
            expect(result.totalAmount).toBe('1002');
            expect(pagedChain.range).toHaveBeenCalledTimes(2);
        });
    });
});
