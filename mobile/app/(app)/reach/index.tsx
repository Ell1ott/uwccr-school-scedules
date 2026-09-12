import { initials } from "@shared/lib/classDetail";
import {
  canLeaveReachRequest,
  canManageReachRequest,
  deleteReachRequest,
  formatReachRange,
  leaveReachRequest,
  leaveTypeMeta,
  reachRequestIsPast,
  respondReachInvite,
  transportLabel,
  useReachCatalog,
  type ReachRequest,
  type ReachRequestStatus,
} from "@shared/lib/reach";
import { useNow } from "@shared/lib/now";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/src/lib/auth";
import { useCatalog } from "@/src/catalog";
import { studentQrPayload } from "@/src/lib/qr";
import {
  ReachButton,
  ReachGroup,
  ReachLabel,
  ReachPage,
  ReachRow,
  ReachSymbol,
  ReachTag,
} from "@/src/reach-ui";
import { reach } from "@/src/theme";

function statusTone(status: ReachRequestStatus) {
  if (status === "approved" || status === "returned") return "ok" as const;
  if (status === "pending" || status === "active") return "wait" as const;
  return "bad" as const;
}

function statusLabel(status: ReachRequestStatus) {
  if (status === "approved") return "Approved";
  if (status === "pending") return "Waiting";
  if (status === "denied") return "Declined";
  if (status === "active") return "Out";
  if (status === "returned") return "Back";
  return "Cancelled";
}

export default function ReachScreen() {
  const auth = useAuth();
  const catalog = useCatalog();
  const { requests } = useReachCatalog(Boolean(auth.session && auth.role));
  const nowMs = Math.floor(useNow().getTime() / 60_000) * 60_000;
  const [showOld, setShowOld] = useState(false);
  const mine = catalog.students.find((student) => student.id === auth.studentId);
  const name = mine?.name ?? auth.displayName ?? "You";
  const { current, old } = useMemo(() => {
    const current: ReachRequest[] = [];
    const old: ReachRequest[] = [];
    for (const request of requests) {
      if (reachRequestIsPast(request, nowMs)) old.push(request);
      else current.push(request);
    }
    return { current, old };
  }, [requests, nowMs]);

  return (
    <ReachPage>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}>
        {auth.studentId ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <ReachLabel>Gate pass</ReachLabel>
            <ReachGroup>
              <View style={{ alignItems: "center", padding: 24 }}>
                <Text style={{ color: reach.ink, fontSize: 22, fontWeight: "700" }}>{name}</Text>
                <View style={{ marginVertical: 16 }}>
                  <QRCode
                    value={studentQrPayload(auth.studentId)}
                    size={200}
                    color={reach.ink}
                    backgroundColor={reach.card}
                  />
                </View>
                <Text style={{ color: reach.muted, fontSize: 15, textAlign: "center" }}>
                  Hold this to the camera at the gate.
                </Text>
              </View>
            </ReachGroup>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text style={{ color: reach.muted, fontSize: 15 }}>
              Staff can review leave from the website. Students see a QR here.
            </Text>
          </View>
        )}

        {current.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <ReachLabel>{auth.studentId ? "Your leaves" : "All requests"}</ReachLabel>
            {current.map((request) => (
              <LeaveCard
                key={request.id}
                request={request}
                students={catalog.students}
              />
            ))}
          </View>
        ) : null}

        {old.length > 0 ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ReachGroup>
              <ReachRow last={!showOld} onPress={() => setShowOld((open) => !open)}>
                <Text style={{ flex: 1, color: reach.ink, fontSize: 17, fontWeight: "600" }}>
                  Old
                </Text>
                <Text style={{ color: reach.muted, fontSize: 15, marginRight: 8 }}>
                  {old.length === 1 ? "1 leave" : `${old.length} leaves`}
                </Text>
                <View style={{ transform: [{ rotate: showOld ? "180deg" : "0deg" }] }}>
                  <ReachSymbol name="chevron.down" />
                </View>
              </ReachRow>
            </ReachGroup>
            {showOld
              ? old.map((request) => (
                  <LeaveCard
                    key={request.id}
                    request={request}
                    students={catalog.students}
                  />
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>
    </ReachPage>
  );
}

function LeaveCard({
  request,
  students,
}: {
  request: ReachRequest;
  students: { id: string; name: string }[];
}) {
  const auth = useAuth();
  const meta = leaveTypeMeta(request.leaveType);
  const manage = canManageReachRequest(request, auth);
  const leave = canLeaveReachRequest(request, auth);
  const invite =
    !reachRequestIsPast(request) &&
    request.companions.find(
      (companion) =>
        companion.studentId === auth.studentId && companion.status === "pending",
    );

  function confirmDelete() {
    Alert.alert("Delete leave", "This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteReachRequest(request.id).then((message) => {
            if (message) Alert.alert("Could not delete", message);
          });
        },
      },
    ]);
  }

  return (
    <View
      style={{
        backgroundColor: reach.card,
        borderRadius: 10,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <ReachTag
          label={meta.shortLabel}
          tone={meta.stamp === "Auto" ? "auto" : meta.stamp === "RC" ? "rc" : "docs"}
        />
        <ReachTag label={statusLabel(request.status)} tone={statusTone(request.status)} />
      </View>
      <Text style={{ color: reach.ink, fontSize: 17, fontWeight: "600" }}>
        {request.destination}
      </Text>
      <Text style={{ color: reach.muted, fontSize: 15, marginTop: 4 }}>
        {formatReachRange(request.startsAt, request.endsAt)}
      </Text>
      <Text style={{ color: reach.muted, fontSize: 13, marginTop: 4 }}>
        {request.transports.map(transportLabel).join(" → ")}
      </Text>
      {request.companions.length ? (
        <Text style={{ color: reach.ink, fontSize: 13, marginTop: 8 }}>
          With{" "}
          {request.companions
            .map(
              (companion) =>
                students.find((student) => student.id === companion.studentId)?.name ??
                initials(companion.studentId),
            )
            .join(", ")}
        </Text>
      ) : null}
      <View style={{ marginTop: 12, gap: 8 }}>
        {invite ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <ReachButton
                label="Accept"
                onPress={() =>
                  void respondReachInvite(request.id, true).then((message) => {
                    if (message) Alert.alert("Invite", message);
                  })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <ReachButton
                label="Decline"
                tone="no"
                onPress={() =>
                  void respondReachInvite(request.id, false).then((message) => {
                    if (message) Alert.alert("Invite", message);
                  })
                }
              />
            </View>
          </View>
        ) : null}
        {manage ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <ReachButton
                label="Edit"
                onPress={() => router.push(`/(app)/reach/${request.id}/edit`)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ReachButton label="Delete" tone="danger" onPress={confirmDelete} />
            </View>
          </View>
        ) : null}
        {leave ? (
          <ReachButton
            label="Leave this request"
            tone="no"
            onPress={() =>
              void leaveReachRequest(request.id).then((message) => {
                if (message) Alert.alert("Leave", message);
              })
            }
          />
        ) : null}
      </View>
    </View>
  );
}
