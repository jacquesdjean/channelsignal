export interface WeeklyReportContent {
  periodStart: string;
  periodEnd: string;
  activityOverview: {
    emailsSent: number;
    emailsReceived: number;
    uniqueOrgsContacted: number;
  };
  newContacts: Array<{
    name: string | null;
    email: string;
    orgName: string | null;
    dateAdded: string;
  }>;
  newOrganizations: Array<{
    name: string;
    domain: string | null;
    type: string | null;
    firstContactDate: string;
  }>;
  activeThreads: Array<{
    subject: string;
    emailCount: number;
    participantOrgs: string[];
    lastActivity: string;
  }>;
  dealActivity: Array<{
    title: string;
    orgName: string | null;
    stage: string;
    status: string;
    lastUpdated: string;
  }>;
}

export interface MeetingBriefContent {
  meetingTitle: string;
  scheduledAt: string | null;
  participants: Array<{
    name: string | null;
    email: string;
    title: string | null;
    orgName: string | null;
  }>;
  organizationContext: {
    name: string;
    type: string | null;
    firstContact: string | null;
    totalEmails: number;
    recentDeals: Array<{
      title: string;
      stage: string;
      status: string;
    }>;
  } | null;
  recentThreadSummary: Array<{
    subject: string;
    date: string;
    snippet: string;
  }>;
  relatedArtifacts: Array<{
    filename: string;
    notes: string | null;
    uploadedAt: string;
  }>;
  openItems: Array<{
    type: 'deal' | 'meeting';
    title: string;
    details: string;
  }>;
}
