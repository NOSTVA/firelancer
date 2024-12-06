import { Buffer } from 'buffer';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BalanceEntryType, CustomerType, ID, Permission } from 'src/common/shared-types';
import { Customer } from 'src/entity';

export class CreateAdministratorInput {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  emailAddress: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsArray()
  roleIds: Array<ID>;
}

export class UpdateAdministratorInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  emailAddress?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsArray()
  @IsOptional()
  roleIds?: Array<ID>;
}

export class UpdateActiveAdministratorInput {
  @IsString()
  @IsOptional()
  emailAddress?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  password?: string;
}

export class CurrentUser {
  @IsNumber()
  id: ID;

  @IsString()
  identifier: string;
}

export class MutationLoginArgs {
  @IsString()
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;

  @IsString()
  username: string;
}

export class NativeAuthInput {
  @IsString()
  password: string;

  @IsString()
  username: string;
}

export class AuthenticationInput {
  @IsOptional()
  native?: NativeAuthInput;
}

export class MutationAuthenticateArgs {
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => AuthenticationInput)
  input: AuthenticationInput;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}

export class CreateCustomerInput {
  @IsString()
  emailAddress: string;

  @IsEnum(CustomerType)
  customerType: CustomerType;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

export class UpdateCustomerInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  emailAddress?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

export class RegisterCustomerInput {
  @IsString()
  emailAddress: string;

  @IsEnum(CustomerType)
  customerType: CustomerType;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  title?: string;
}

export class CreateRoleInput {
  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsArray()
  permissions: Array<Permission>;
}

export class UpdateRoleInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  permissions?: Array<Permission>;
}

export class MutationRegisterCustomerAccountArgs {
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => RegisterCustomerInput)
  input: RegisterCustomerInput;
}

export class MutationVerifyCustomerAccountArgs {
  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  token: string;
}

export class MutationRefreshCustomerVerificationArgs {
  @IsString()
  emailAddress: string;
}

export class MutationRequestPasswordResetArgs {
  @IsString()
  emailAddress: string;
}

export class MutationResetPasswordArgs {
  @IsString()
  password: string;

  @IsString()
  token: string;
}

export class MutationUpdateCustomerPasswordArgs {
  @IsString()
  currentPassword: string;

  @IsString()
  newPassword: string;
}

export class MutationRequestUpdateCustomerEmailAddressArgs {
  @IsString()
  newEmailAddress: string;

  @IsString()
  password: string;
}

export class MutationUpdateCustomerEmailAddressArgs {
  @IsString()
  token: string;
}

export class MutationCreateAdministratorArgs {
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateAdministratorInput)
  input: CreateAdministratorInput;
}

export class MutationUpdateAdministratorArgs {
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateAdministratorInput)
  input: UpdateAdministratorInput;
}

export class MutationUpdateActiveAdministratorArgs {
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateActiveAdministratorInput)
  input: UpdateActiveAdministratorInput;
}

export class MutationAssignRoleToAdministratorArgs {
  @IsNumber()
  administratorId: ID;

  @IsNumber()
  roleId: ID;
}

export class MutationDeleteAdministratorArgs {
  @IsNumber()
  id: ID;
}

export class QueryAdministratorArgs {
  @IsNumber()
  id: ID;
}

export class File {
  @IsString()
  originalname: string;

  @IsString()
  mimetype: string;

  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @Type(() => Buffer)
  buffer: Buffer;

  @IsNumber()
  size: number;
}

export class CreateAssetInput {
  @IsDefined()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => File)
  file: File;
}

export class CoordinateInput {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class UpdateAssetInput {
  @IsNumber()
  id: ID;

  focalPoint?: CoordinateInput;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  tags?: string;
}

export class CreateCategoryInput {
  @IsString()
  code: string;

  @IsString()
  prefLabel: string;

  @IsString()
  description: string;
}

export class UpdateCategoryInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  prefLabel?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateSkillInput {
  @IsString()
  code: string;

  @IsString()
  prefLabel: string;

  @IsString()
  description: string;

  @IsNumber()
  @IsOptional()
  categoryId?: number;
}

export class UpdateSkillInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  prefLabel?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  categoryId?: number;
}

export class CreateJobPostInput {
  @IsNumber()
  customerId: ID;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsBoolean()
  enabled: boolean;

  @IsBoolean()
  private: boolean;

  @IsArray()
  @IsOptional()
  assetIds?: ID[];

  @IsArray()
  @IsOptional()
  facetValueIds?: ID[];
}

export class MutationCreateJobPostArgs {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsBoolean()
  private: boolean;

  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsArray()
  @IsOptional()
  facetValueIds?: ID[];
}

export class CreateFacetValueInput {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  facetId: ID;

  @IsNumber()
  @IsOptional()
  categoryId?: ID;
}

export class CreateFacetValueWithFacetInput {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  categoryId?: ID;
}

export class UpdateFacetValueInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  categoryId?: ID;

  @IsNumber()
  @IsOptional()
  facetId?: ID;
}

export class CreateFacetInput {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateFacetValueWithFacetInput)
  values?: CreateFacetValueWithFacetInput[];
}

export class UpdateFacetInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class CreateFacetValueCategoryInput {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsNumber()
  facetId: ID;
}

export class UpdateFacetValueCategoryInput {
  @IsNumber()
  id: ID;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  facetId?: ID;
}

export class CreateBalanceEntryInput {
  customer: Customer;

  @IsEnum(BalanceEntryType)
  type: BalanceEntryType;

  @IsInt()
  @IsPositive()
  @IsOptional()
  reviewDays?: number;

  @IsInt()
  @IsPositive()
  credit: number;

  @IsInt()
  @IsPositive()
  debit: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  metadata?: Record<string, string>;
}
