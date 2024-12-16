import { Permission } from '../common';

export interface CountryDefinition {
  code: string;
  name: string;
  zone: string;
}

export interface FacetValueCollectionFilterDefinition {
  code: 'facet-value-filter';
  args: {
    facetValueNames: string[];
    containsAny: boolean;
  };
}

export type CollectionFilterDefinition = FacetValueCollectionFilterDefinition;

export type FacetDefinition = `${string}:${string}`;

export interface CollectionDefinition {
  name: string;
  description?: string;
  slug?: string;
  private?: boolean;
  filters?: CollectionFilterDefinition[];
  inheritFilters?: boolean;
  parentName?: string;
  assetPaths?: string[];
}

export interface RoleDefinition {
  code: string;
  description: string;
  permissions: Permission[];
}

/**
 * @description
 * An object defining initial settings for a new Firelancer installation.
 */
export interface InitialData {
  roles?: RoleDefinition[];
  facets: FacetDefinition[];
  countries: CountryDefinition[];
  collections: CollectionDefinition[];
}