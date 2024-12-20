import { ConfigArgDef } from '../../../../common/configurable-operation';
import { JobPost } from '../../../../entity';
import { CollectionFilter } from '../collection-filter';

const { customAlphabet } = require('nanoid');

/**
 * @description
 * Used to created unique key names for DB query parameters, to avoid conflicts if the
 * same filter is applied multiple times.
 */
export function randomSuffix(prefix: string) {
    const nanoid = customAlphabet('123456789abcdefghijklmnopqrstuvwxyz', 6);
    return `${prefix}_${nanoid() as string}`;
}

/**
 * @description
 * Add this to your CollectionFilter `args` object to display the standard UI component
 * for selecting the combination mode when working with multiple filters.
 */
export const combineWithAndArg: ConfigArgDef<'boolean'> = {
    type: 'boolean',
    label: 'Combination mode',
    description:
        'If this filter is being combined with other filters, do all conditions need to be satisfied (AND), or just one or the other (OR)?',
    defaultValue: true,
};

/**
 * Filters for JobPosts having the given facetValueIds
 */
export const facetValueCollectionFilter = new CollectionFilter({
    args: {
        facetValueIds: {
            type: 'ID',
            list: true,
            label: 'Facet values',
        },
        containsAny: {
            type: 'boolean',
            label: 'Contains any',
            description:
                'If checked, job-posts must have at least one of the selected facet values. If not checked, the job-post must have all selected values.',
        },
        combineWithAnd: combineWithAndArg,
    },
    code: 'facet-value-filter',
    description: 'Filter by facet values',
    apply: (qb, args) => {
        const ids = args.facetValueIds;

        if (ids.length) {
            // uuid IDs can include `-` chars, which we cannot use in a TypeORM key name.
            const safeIdsConcat = ids.join('_').replace(/-/g, '_');
            const idsName = `ids_${safeIdsConcat}`;
            const countName = `count_${safeIdsConcat}`;
            const jobPostQuery = qb.connection
                .createQueryBuilder(JobPost, 'job_post')
                .select('job_post.id', 'job_post_id')
                .addSelect('facet_value.id', 'facet_value_id')
                .leftJoin('job_post.facetValues', 'facet_value')
                .where(`facet_value.id IN (:...${idsName})`);

            const jobPostIds = qb.connection
                .createQueryBuilder()
                .select('job_post_ids_table.job_post_id')
                .from(`(${jobPostQuery.getQuery()})`, 'job_post_ids_table')
                .groupBy('job_post_id')
                .having(`COUNT(*) >= :${countName}`);

            const clause = `jobPost.id IN (${jobPostIds.getQuery()})`;
            const params = {
                [idsName]: ids,
                [countName]: args.containsAny ? 1 : ids.length,
            };
            if (args.combineWithAnd !== false) {
                qb.andWhere(clause).setParameters(params);
            } else {
                qb.orWhere(clause).setParameters(params);
            }
        } else {
            // If no facetValueIds are specified, no JobPosts will be matched.
            if (args.combineWithAnd !== false) {
                qb.andWhere('1 = 0');
            }
        }
        return qb;
    },
});

export const jobPostIdCollectionFilter = new CollectionFilter({
    args: {
        jobPostIds: {
            type: 'ID',
            list: true,
            label: 'Job Posts',
        },
        combineWithAnd: combineWithAndArg,
    },
    code: 'job-post-id-filter',
    description: 'Manually select job posts',
    apply: (qb, args) => {
        const emptyIds = args.jobPostIds.length === 0;
        const jobPostIdsKey = randomSuffix('jobPostIds');
        const clause = `jobPost.id IN (:...${jobPostIdsKey})`;
        const params = { [jobPostIdsKey]: args.jobPostIds };
        if (args.combineWithAnd === false) {
            if (emptyIds) {
                return qb;
            }
            return qb.orWhere(clause, params);
        } else {
            if (emptyIds) {
                return qb.andWhere('1 = 0');
            }
            return qb.andWhere(clause, params);
        }
    },
});

export const defaultCollectionFilters = [facetValueCollectionFilter, jobPostIdCollectionFilter];
