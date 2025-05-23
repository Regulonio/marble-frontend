import { CollapsiblePaper, Page } from '@app-builder/components';
import { BreadCrumbLink, type BreadCrumbProps } from '@app-builder/components/Breadcrumbs';
import { isAdmin } from '@app-builder/models';
import { type InboxUser, tKeyForInboxUserRole } from '@app-builder/models/inbox';
import { DeleteInbox } from '@app-builder/routes/ressources+/settings+/inboxes+/delete';
import { CreateInboxUser } from '@app-builder/routes/ressources+/settings+/inboxes+/inbox-users.create';
import { DeleteInboxUser } from '@app-builder/routes/ressources+/settings+/inboxes+/inbox-users.delete';
import { UpdateInboxUser } from '@app-builder/routes/ressources+/settings+/inboxes+/inbox-users.update';
import { UpdateInbox } from '@app-builder/routes/ressources+/settings+/inboxes+/update';
import {
  getInboxUserRoles,
  isCreateInboxUserAvailable,
  isDeleteInboxAvailable,
  isDeleteInboxUserAvailable,
  isEditInboxAvailable,
  isEditInboxUserAvailable,
  isInboxAdmin,
} from '@app-builder/services/feature-access';
import { initServerServices } from '@app-builder/services/init.server';
import { useOrganizationUsers } from '@app-builder/services/organization/organization-users';
import { getRoute, type RouteID } from '@app-builder/utils/routes';
import { fromParams, fromUUIDtoSUUID } from '@app-builder/utils/short-uuid';
import { json, type LoaderFunctionArgs, redirect, type SerializeFrom } from '@remix-run/node';
import { useLoaderData, useRouteLoaderData } from '@remix-run/react';
import { createColumnHelper, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';
import { type Namespace } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Tooltip, useTable } from 'ui-design-system';

export const handle = {
  i18n: ['settings', 'common'] satisfies Namespace,
  BreadCrumbs: [
    ({ isLast }: BreadCrumbProps) => {
      const { t } = useTranslation(['settings']);
      return (
        <BreadCrumbLink to={getRoute('/settings/inboxes')} isLast={isLast}>
          {t('settings:inboxes')}
        </BreadCrumbLink>
      );
    },
    ({ isLast }: BreadCrumbProps) => {
      const { inbox } = useRouteLoaderData(
        'routes/_builder+/settings+/inboxes.$inboxId' satisfies RouteID,
      ) as SerializeFrom<typeof loader>;

      return (
        <BreadCrumbLink
          isLast={isLast}
          to={getRoute('/settings/inboxes/:inboxId', {
            inboxId: fromUUIDtoSUUID(inbox.id),
          })}
        >
          {inbox.name}
        </BreadCrumbLink>
      );
    },
  ],
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { authService } = initServerServices(request);
  const {
    user,
    inbox: inboxApi,
    entitlements,
  } = await authService.isAuthenticated(request, {
    failureRedirect: getRoute('/sign-in'),
  });

  const inboxId = fromParams(params, 'inboxId');
  const inboxesList = await inboxApi.listInboxesWithCaseCount();
  const inbox = inboxesList.find((inbox) => inbox.id === inboxId);

  if (!inbox) return redirect(getRoute('/settings/inboxes'));
  if (!isAdmin(user) && !isInboxAdmin(user, inbox)) {
    return redirect(getRoute('/'));
  }

  const escalationInboxes = await inboxApi.listInboxesMetadata();

  return json({
    inbox,
    inboxesList,
    escalationInboxes,
    escalationInbox: inbox.escalationInboxId
      ? await inboxApi.getInboxMetadata(inbox.escalationInboxId)
      : null,
    caseCount: inbox.casesCount,
    entitlements,
    inboxUserRoles: getInboxUserRoles(entitlements),
    isEditInboxAvailable: isEditInboxAvailable(user, inbox),
    isDeleteInboxAvailable: isDeleteInboxAvailable(user),
    isCreateInboxUserAvailable: isCreateInboxUserAvailable(user, inbox),
    isEditInboxUserAvailable: isEditInboxUserAvailable(user, inbox),
    isDeleteInboxUserAvailable: isDeleteInboxUserAvailable(user, inbox),
  });
}

const columnHelper = createColumnHelper<InboxUser>();

export default function Inbox() {
  const {
    caseCount,
    inbox,
    escalationInboxes,
    escalationInbox,
    inboxUserRoles,
    entitlements,
    isEditInboxAvailable,
    isDeleteInboxAvailable,
    isCreateInboxUserAvailable,
    isEditInboxUserAvailable,
    isDeleteInboxUserAvailable,
  } = useLoaderData<typeof loader>();
  const { t } = useTranslation(handle.i18n);
  const { orgUsers } = useOrganizationUsers();

  const columns = useMemo(() => {
    return [
      columnHelper.accessor((row) => row.userId, {
        id: 'name',
        header: t('settings:inboxes.name'),
        size: 200,
        cell: ({ getValue }) => {
          const user = orgUsers.find((u) => u.userId === getValue());
          if (!user) return;
          return `${user.firstName} ${user.lastName}`;
        },
      }),
      columnHelper.accessor((row) => row.role, {
        id: 'role',
        header: t('settings:inboxes.inbox_details.role'),
        size: 200,
        cell: ({ getValue }) => t(tKeyForInboxUserRole(getValue())),
      }),
      ...(isEditInboxUserAvailable || isDeleteInboxUserAvailable
        ? [
            columnHelper.display({
              id: 'actions',
              size: 100,
              cell: ({ cell }) => {
                return (
                  <div className="flex gap-2">
                    {isEditInboxUserAvailable ? (
                      // TODO: inject trigger inside <UpdateTag /> and use style directly on it (so we can remove the container div)
                      <div className="group-hover:text-grey-00 focus-within:text-grey-00 text-transparent">
                        <UpdateInboxUser
                          inboxUser={cell.row.original}
                          inboxUserRoles={inboxUserRoles}
                          access={entitlements.userRoles}
                        />
                      </div>
                    ) : null}
                    {isDeleteInboxUserAvailable ? (
                      // TODO: inject trigger inside <UpdateTag /> and use style directly on it (so we can remove the container div)
                      <div className="group-hover:text-grey-00 focus-within:text-grey-00 text-transparent">
                        <DeleteInboxUser inboxUser={cell.row.original} />
                      </div>
                    ) : null}
                  </div>
                );
              },
            }),
          ]
        : []),
    ];
  }, [
    inboxUserRoles,
    isDeleteInboxUserAvailable,
    isEditInboxUserAvailable,
    orgUsers,
    t,
    entitlements.userRoles,
  ]);

  const { table, getBodyProps, rows, getContainerProps } = useTable({
    data: inbox.users ?? [],
    columns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const nonInboxUsers = orgUsers.filter(
    (user) => !inbox.users?.some((u) => u.userId === user.userId),
  );

  return (
    <Page.Container>
      <Page.Content className="max-w-screen-xl">
        <CollapsiblePaper.Container>
          <CollapsiblePaper.Title>
            <span className="flex-1">{t('settings:inboxes.inbox_details.title')}</span>
            {isEditInboxAvailable ? (
              <UpdateInbox
                inbox={inbox}
                escalationInboxes={escalationInboxes}
                redirectRoutePath="/settings/inboxes/:inboxId"
              />
            ) : null}
          </CollapsiblePaper.Title>
          <CollapsiblePaper.Content>
            <div className="grid auto-rows-fr grid-cols-[max-content_1fr] items-center gap-x-10 gap-y-4">
              <span className="font-bold">{t('settings:inboxes.name')}</span>
              {inbox.name}
              <span className="font-bold">{t('settings:inboxes.inbox_details.case_count')}</span>
              {caseCount}
              <span className="font-bold">
                {t('settings:inboxes.inbox_details.escalation_inbox')}
              </span>
              {escalationInbox?.name ?? t('settings:inboxes.inbox_details.no_escalation_inbox')}
            </div>
          </CollapsiblePaper.Content>
        </CollapsiblePaper.Container>

        <CollapsiblePaper.Container>
          <CollapsiblePaper.Title>
            <span className="flex-1">{t('settings:inboxes.inbox_details.members')}</span>
            {isCreateInboxUserAvailable ? (
              <CreateInboxUser
                inboxId={inbox.id}
                users={nonInboxUsers}
                inboxUserRoles={inboxUserRoles}
                access={entitlements.userRoles}
              />
            ) : null}
          </CollapsiblePaper.Title>
          <CollapsiblePaper.Content>
            <Table.Container {...getContainerProps()} className="max-h-96">
              <Table.Header headerGroups={table.getHeaderGroups()} />
              <Table.Body {...getBodyProps()}>
                {rows.map((row) => {
                  return <Table.Row key={row.id} className="hover:bg-purple-98 group" row={row} />;
                })}
              </Table.Body>
            </Table.Container>
          </CollapsiblePaper.Content>
        </CollapsiblePaper.Container>

        {isDeleteInboxAvailable ? (
          caseCount === 0 ? (
            <DeleteInbox inbox={inbox} />
          ) : (
            <Tooltip.Default
              content={
                <p className="p-2">{t('settings:inboxes.inbox_details.delete_inbox.tooltip')}</p>
              }
            >
              <span className="w-fit">
                <DeleteInbox inbox={inbox} disabled />
              </span>
            </Tooltip.Default>
          )
        ) : null}
      </Page.Content>
    </Page.Container>
  );
}
