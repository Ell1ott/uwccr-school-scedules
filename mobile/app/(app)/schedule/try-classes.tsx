import { academicRowsFor } from "@shared/data/weekTemplate";
import {
  BLOCK_LETTERS,
  countLevels,
  keepOfferedPicks,
  offeringKey,
  offeringsForCohort,
  issuesByBlock,
  seedBlocksFromStudent,
  toClassEntry,
  validateChooser,
  type ClassOffering,
} from "@shared/lib/classCatalog";
import { COHORT_TABS } from "@shared/lib/school";
import type { BlockLetter, ClassEntry, CohortId, DayId } from "@shared/types";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useCatalog } from "@/src/catalog";
import { Body, Chip, Screen, Scroll } from "@/src/ui";

export default function TryClassesScreen() {
  const { students, student, communityMeeting } = useCatalog();
  const [cohort, setCohort] = useState<CohortId | null>(student?.cohort ?? null);
  const [blocks, setBlocks] = useState<Partial<Record<BlockLetter, ClassEntry>>>(
    () => (student ? seedBlocksFromStudent(student) : {}),
  );
  const catalog = useMemo(
    () => (cohort ? offeringsForCohort(students, cohort) : null),
    [students, cohort],
  );
  const counts = useMemo(() => countLevels(blocks), [blocks]);
  const issues = useMemo(() => (cohort ? validateChooser(blocks) : []), [cohort, blocks]);
  const flagged = useMemo(
    () => (cohort ? issuesByBlock(blocks) : {}),
    [cohort, blocks],
  );
  const rows = useMemo(
    () => academicRowsFor(communityMeeting),
    [communityMeeting],
  );

  function chooseCohort(next: CohortId) {
    setCohort(next);
    if (student?.cohort === next) {
      setBlocks(seedBlocksFromStudent(student));
      return;
    }
    const nextCatalog = offeringsForCohort(students, next);
    setBlocks((prev) => keepOfferedPicks(prev, nextCatalog));
  }

  function selectOffering(block: BlockLetter, offering: ClassOffering) {
    setBlocks((prev) => {
      const current = prev[block];
      if (current && offeringKey(current) === offeringKey(offering)) {
        const next = { ...prev };
        delete next[block];
        return next;
      }
      return { ...prev, [block]: toClassEntry(offering) };
    });
  }

  return (
    <Screen>
      <Scroll>
        <Body muted>Preview only. Nothing is saved to a real schedule.</Body>
        <View className="mt-4 flex-row">
          {COHORT_TABS.map((tab) => (
            <Chip
              key={tab.id}
              label={tab.label}
              selected={cohort === tab.id}
              onPress={() => chooseCohort(tab.id)}
            />
          ))}
        </View>
        {cohort ? (
          <Text className="mb-3 font-medium text-on-surface-variant">
            HL {counts.HL}/3 · SL {counts.SL}/3 · TOK {counts.TOK}/1
          </Text>
        ) : null}
        {issues.length ? (
          <Text className="mb-3 font-sans text-error">{issues.join(" ")}</Text>
        ) : null}
        {rows.map((row) => (
          <View key={`${row.start}-${row.end}`} className="mb-2 rounded-2xl bg-surface-container-lowest px-3 py-2">
            <Text className="font-medium text-[12px] text-on-surface-variant">
              {row.start} – {row.end}
            </Text>
            <Text className="font-sans text-on-surface">
              {(["mon", "tue", "wed", "thu", "fri"] as DayId[])
                .map((day) => {
                  const letter = row.blocks[day];
                  if (!letter) return "·";
                  return blocks[letter]?.subject ?? letter;
                })
                .join("  ·  ")}
            </Text>
          </View>
        ))}
        {catalog
          ? BLOCK_LETTERS.map((block) => (
              <View key={block} className="mt-5">
                <Text className="mb-2 font-bold text-[22px] text-on-surface">
                  Block {block}
                  {flagged[block] ? "  !" : ""}
                </Text>
                {catalog[block].map((offering) => {
                  const selected =
                    blocks[block] &&
                    offeringKey(blocks[block]!) === offeringKey(offering);
                  return (
                    <Pressable
                      key={offeringKey(offering)}
                      onPress={() => selectOffering(block, offering)}
                      className={`mb-2 rounded-2xl px-3 py-3 ${selected ? "bg-primary" : "bg-surface-container"}`}
                    >
                      <Text className={`font-medium ${selected ? "text-on-primary" : "text-on-surface"}`}>
                        {offering.subject} {offering.level}
                      </Text>
                      <Text className={`font-sans text-[13px] ${selected ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                        {offering.teacher} · {offering.room} · {offering.studentCount}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          : null}
      </Scroll>
    </Screen>
  );
}
