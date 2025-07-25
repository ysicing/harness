/*
 * Copyright 2023 Harness, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState } from 'react'
import { PopoverInteractionKind, Spinner } from '@blueprintjs/core'
import { useGet, useMutate } from 'restful-react'
import { isEmpty, omit } from 'lodash-es'
import cx from 'classnames'
import { Container, Layout, Text, Avatar, FlexExpander, useToaster, Utils, stringSubstitute } from '@harnessio/uicore'
import { Icon, IconName } from '@harnessio/icons'
import { Color, FontVariation } from '@harnessio/design-system'
import { OptionsMenuButton } from 'components/OptionsMenuButton/OptionsMenuButton'
import { useStrings } from 'framework/strings'
import type { TypesPullReq, RepoRepositoryOutput, EnumPullReqReviewDecision, TypesScopesLabels } from 'services/code'
import { ColorName, getErrorMessage } from 'utils/Utils'
import { ReviewerSelect } from 'components/ReviewerSelect/ReviewerSelect'
import { PullReqReviewDecision, processReviewDecision } from 'pages/PullRequest/PullRequestUtils'
import { LabelSelector } from 'components/Label/LabelSelector/LabelSelector'
import { Label } from 'components/Label/Label'
import { getConfig } from 'services/config'
import ignoreFailed from '../../../../icons/ignoreFailed.svg?url'
import css from './PullRequestSideBar.module.scss'

interface PullRequestSideBarProps {
  reviewers?: Unknown
  labels: TypesScopesLabels | null
  repoMetadata: RepoRepositoryOutput
  pullRequestMetadata: TypesPullReq
  refetchReviewers: () => void
  refetchLabels: () => void
  refetchActivities: () => void
}

const PullRequestSideBar = (props: PullRequestSideBarProps) => {
  const [labelQuery, setLabelQuery] = useState<string>('')
  const { reviewers, repoMetadata, pullRequestMetadata, refetchReviewers, labels, refetchLabels, refetchActivities } =
    props
  const { getString } = useStrings()
  const { showError, showSuccess } = useToaster()
  const generateReviewDecisionInfo = (
    reviewDecision: EnumPullReqReviewDecision | PullReqReviewDecision.OUTDATED
  ): {
    name: IconName
    color?: Color
    size?: number
    icon: IconName
    className?: string
    iconProps?: { color?: Color }
    message: string
  } => {
    let info: {
      name: IconName
      color?: Color
      size?: number
      className?: string
      icon: IconName
      iconProps?: { color?: Color }
      message: string
    }

    switch (reviewDecision) {
      case PullReqReviewDecision.CHANGEREQ:
        info = {
          name: 'error-transparent-no-outline',
          color: Color.RED_700,
          size: 18,
          className: css.redIcon,
          icon: 'error-transparent-no-outline',
          iconProps: { color: Color.RED_700 },
          message: 'requested changes'
        }
        break
      case PullReqReviewDecision.APPROVED:
        info = {
          name: 'tick-circle',
          color: Color.GREEN_700,
          size: 16,
          icon: 'tick-circle',
          iconProps: { color: Color.GREEN_700 },
          message: 'approved changes'
        }
        break
      case PullReqReviewDecision.PENDING:
        info = {
          name: 'waiting',
          color: Color.GREY_700,
          size: 16,
          icon: 'waiting',
          iconProps: { color: Color.GREY_700 },
          message: 'pending review'
        }
        break
      case PullReqReviewDecision.OUTDATED:
        info = {
          name: 'dot',
          color: Color.GREY_100,
          size: 16,
          icon: 'dot',
          message: 'outdated approval'
        }
        break
      default:
        info = {
          name: 'dot',
          color: Color.GREY_100,
          size: 16,
          icon: 'dot',
          message: 'status'
        }
    }

    return info
  }

  const { mutate: updateCodeCommentStatus } = useMutate({
    verb: 'PUT',
    path: `/api/v1/repos/${repoMetadata.path}/+/pullreq/${pullRequestMetadata.number}/reviewers`
  })
  const { mutate: removeReviewer } = useMutate({
    verb: 'DELETE',
    path: ({ id }) => `/api/v1/repos/${repoMetadata.path}/+/pullreq/${pullRequestMetadata?.number}/reviewers/${id}`
  })

  const { mutate: removeLabel, loading: removingLabel } = useMutate({
    verb: 'DELETE',
    base: getConfig('code/api/v1'),
    path: ({ label_id }) => `/repos/${repoMetadata.path}/+/pullreq/${pullRequestMetadata?.number}/labels/${label_id}`
  })

  const {
    data: labelsList,
    refetch: refetchlabelsList,
    loading: labelListLoading
  } = useGet<TypesScopesLabels>({
    base: getConfig('code/api/v1'),
    path: `/repos/${repoMetadata.path}/+/pullreq/${pullRequestMetadata?.number}/labels`,
    queryParams: { assignable: true, query: labelQuery },
    debounce: 500
  })

  //TODO: add actions when you click the options menu button and also api integration when there's optional and required reviwers
  return (
    <Container width={`30%`}>
      <Container padding={{ left: 'xxlarge' }}>
        <Layout.Vertical>
          <Layout.Horizontal>
            <Text style={{ lineHeight: '24px' }} font={{ variation: FontVariation.H6 }}>
              {getString('reviewers')}
            </Text>
            <FlexExpander />
            <ReviewerSelect
              pullRequestMetadata={pullRequestMetadata}
              onSelect={function (id: number): void {
                updateCodeCommentStatus({ reviewer_id: id })
                  .then(() => refetchActivities())
                  .catch(err => {
                    showError(getErrorMessage(err))
                  })
                if (refetchReviewers) {
                  refetchReviewers()
                }
              }}
            />
          </Layout.Horizontal>
          <Container padding={{ top: 'medium', bottom: 'large' }}>
            {!isEmpty(reviewers) ? (
              reviewers.map(
                (reviewer: {
                  reviewer: { display_name: string; id: number }
                  review_decision: EnumPullReqReviewDecision
                  sha: string
                }): Unknown => {
                  const updatedReviewDecision = processReviewDecision(
                    reviewer.review_decision,
                    reviewer.sha,
                    pullRequestMetadata?.source_sha
                  )
                  const reviewerInfo = generateReviewDecisionInfo(updatedReviewDecision)
                  return (
                    <Layout.Horizontal key={reviewer.reviewer.id} className={css.alignLayout}>
                      <Utils.WrapOptionalTooltip
                        tooltip={
                          <Text color={Color.GREY_100} padding="small">
                            {reviewerInfo.message}
                          </Text>
                        }
                        tooltipProps={{ isDark: true, interactionKind: PopoverInteractionKind.HOVER }}>
                        {updatedReviewDecision === PullReqReviewDecision.OUTDATED ? (
                          <img className={css.svgOutdated} src={ignoreFailed} width={20} height={20} />
                        ) : (
                          <Icon {...omit(reviewerInfo, 'iconProps')} />
                        )}
                      </Utils.WrapOptionalTooltip>
                      <Avatar
                        className={cx(css.reviewerAvatar, {
                          [css.iconPadding]: updatedReviewDecision !== PullReqReviewDecision.CHANGEREQ
                        })}
                        name={reviewer.reviewer.display_name}
                        size="small"
                        hoverCard={false}
                      />

                      <Text lineClamp={1} className={css.reviewerName}>
                        {reviewer.reviewer.display_name}
                      </Text>
                      <FlexExpander />
                      <OptionsMenuButton
                        isDark={true}
                        icon="Options"
                        iconProps={{ size: 14 }}
                        style={{ paddingBottom: '9px' }}
                        width="100px"
                        height="24px"
                        items={[
                          {
                            isDanger: true,
                            text: getString('remove'),
                            onClick: () => {
                              removeReviewer({}, { pathParams: { id: reviewer.reviewer.id } })
                                .then(() => refetchActivities())
                                .catch(err => {
                                  showError(getErrorMessage(err))
                                })
                              if (refetchReviewers) {
                                refetchReviewers?.()
                              }
                            }
                          }
                        ]}
                      />
                    </Layout.Horizontal>
                  )
                }
              )
            ) : (
              <Text color={Color.GREY_300} font={{ variation: FontVariation.BODY2_SEMI, size: 'small' }}>
                {getString('noReviewers')}
              </Text>
            )}
          </Container>
        </Layout.Vertical>

        <Layout.Vertical>
          <Layout.Horizontal>
            <Text style={{ lineHeight: '24px' }} font={{ variation: FontVariation.H6 }}>
              {getString('labels.labels')}
            </Text>
            <FlexExpander />

            <LabelSelector
              pullRequestMetadata={pullRequestMetadata}
              allLabelsData={labelsList}
              refetchLabels={refetchLabels}
              refetchlabelsList={refetchlabelsList}
              repoMetadata={repoMetadata}
              query={labelQuery}
              setQuery={setLabelQuery}
              labelListLoading={labelListLoading}
              refetchActivities={refetchActivities}
            />
          </Layout.Horizontal>
          <Container padding={{ top: 'medium', bottom: 'large' }}>
            <Layout.Horizontal className={css.labelsLayout}>
              {!isEmpty(labels?.label_data) ? (
                labels?.label_data?.map((label, index) => (
                  <Label
                    key={index}
                    name={label.key as string}
                    label_color={label.color as ColorName}
                    label_value={{
                      name: label.assigned_value?.value as string,
                      color: label.assigned_value?.color as ColorName
                    }}
                    scope={label.scope}
                    removeLabelBtn={true}
                    disableRemoveBtnTooltip={true}
                    handleRemoveClick={() => {
                      removeLabel({}, { pathParams: { label_id: label.id } })
                        .then(() => {
                          label.assigned_value?.value
                            ? showSuccess(
                                stringSubstitute(getString('labels.removedLabel'), {
                                  label: `${label.key}:${label.assigned_value?.value}`
                                }) as string
                              )
                            : showSuccess(
                                stringSubstitute(getString('labels.removedLabel'), {
                                  label: label.key
                                }) as string
                              )
                          refetchActivities()
                        })
                        .catch(err => {
                          showError(getErrorMessage(err))
                        })
                      refetchLabels()
                    }}
                  />
                ))
              ) : (
                <Text color={Color.GREY_300} font={{ variation: FontVariation.BODY2_SEMI, size: 'small' }}>
                  {getString('labels.noLabels')}
                </Text>
              )}
              {removingLabel && <Spinner size={16} />}
            </Layout.Horizontal>
          </Container>
        </Layout.Vertical>
      </Container>
    </Container>
  )
}

export default PullRequestSideBar
