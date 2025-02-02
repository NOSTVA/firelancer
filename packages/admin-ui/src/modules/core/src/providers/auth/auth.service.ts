import { inject, Injectable } from '@angular/core';
import { AttemptLoginMutation } from '@firelancer/common/lib/shared-schema';
import { Observable, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, tap } from 'rxjs/operators';
import { DataService } from '../../data/providers/data.service';
import { PermissionsService } from '../permissions/permissions.service';

/**
 * This service handles logic relating to authentication of the current user.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private dataService = inject(DataService);
    private permissionsService = inject(PermissionsService);

    /**
     * Attempts to log in via the REST login endpoint and updates the app
     * state on success.
     */
    logIn(username: string, password: string, rememberMe: boolean): Observable<AttemptLoginMutation> {
        return this.dataService.auth.attemptLogin(username, password, rememberMe).pipe(
            switchMap((response) => {
                this.permissionsService.setCurrentUserPermissions(response.login.permissions);
                return this.dataService.administrator.getActiveAdministrator().pipe(
                    switchMap(({ activeAdministrator }) => {
                        if (activeAdministrator) {
                            return this.dataService.client
                                .loginSuccess(
                                    activeAdministrator.id,
                                    `${activeAdministrator.firstName} ${activeAdministrator.lastName}`,
                                    response.login.permissions,
                                )
                                .pipe(map(() => response));
                        } else {
                            return of(response);
                        }
                    }),
                );
            }),
        );
    }

    /**
     * Update the user status to being logged out.
     */
    logOut(): Observable<boolean> {
        return this.dataService.client.userStatus().pipe(
            switchMap((status) => {
                if (status?.isLoggedIn) {
                    this.dataService.client.logOut();
                    return this.dataService.auth.logOut();
                } else {
                    return [];
                }
            }),
            tap(() => {
                // TODO: alerts
            }),
            map(() => true),
        );
    }

    /**
     * Checks the app state to see if the user is already logged in,
     * and if not, attempts to validate any auth token found.
     */
    checkAuthenticatedStatus(): Observable<boolean> {
        return this.dataService.client.userStatus().pipe(
            mergeMap((status) => {
                if (!status.isLoggedIn) {
                    return this.validateAuthToken();
                } else {
                    return of(true);
                }
            }),
        );
    }

    /**
     * Checks for an auth token and if found, attempts to validate
     * that token against the API.
     */
    validateAuthToken(): Observable<boolean> {
        return this.dataService.auth.currentUser().pipe(
            mergeMap(({ me }) => {
                if (!me) {
                    return of(false);
                }
                this.permissionsService.setCurrentUserPermissions(me.permissions);
                return this.dataService.administrator.getActiveAdministrator().pipe(
                    switchMap(({ activeAdministrator }) => {
                        if (activeAdministrator) {
                            return this.dataService.client
                                .loginSuccess(
                                    activeAdministrator.id,
                                    `${activeAdministrator.firstName} ${activeAdministrator.lastName}`,
                                    me.permissions,
                                )
                                .pipe(map(() => true));
                        } else {
                            return of(false);
                        }
                    }),
                );
            }),
            map(() => true),
            catchError(() => of(false)),
        );
    }
}
