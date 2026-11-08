import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';

import { TextField } from '@/components/auth/text-field';
import { Avatar } from '@/components/mintsy/avatar';
import { SelectChip } from '@/components/mintsy/select-chip';
import { Spinner } from '@/components/mintsy/spinner';
import { SafeAreaView } from '@/components/safe-area-view';
import { SegmentedControl } from '@/components/settings/segmented-control';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { DAILY_GOALS, INTERESTS, type DailyGoal, type Interest } from '@/data/interests';
import { authClient } from '@/lib/auth-client';
import { useOnboarding } from '@/lib/onboarding';
import { providerLabel, useLinkedAccounts } from '@/lib/social-auth';

const GOAL_OPTIONS = DAILY_GOALS.map((g) => ({ label: g.short, value: g.minutes }));

export default function EditProfileScreen() {
  const { data: session } = authClient.useSession();
  const { data, update } = useOnboarding();
  // Apple / Google-only accounts can't change their email here (it comes from the provider)
  const accounts = useLinkedAccounts();
  const socialOnly = !accounts.loading && !accounts.hasPassword;

  const [name, setName] = useState(session?.user.name ?? '');
  const [goal, setGoal] = useState<DailyGoal>(data.dailyGoal);
  const [interests, setInterests] = useState<Interest[]>(data.interests);
  const [saving, setSaving] = useState(false);

  const toggle = (interest: Interest) =>
    setInterests((cur) => (cur.includes(interest) ? cur.filter((i) => i !== interest) : [...cur, interest]));

  async function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter the name you’d like to show on your profile.');
      return;
    }
    setSaving(true);
    if (trimmed !== session?.user.name) {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) {
        setSaving(false);
        Alert.alert('Couldn’t save your name', error.message ?? 'Please try again.');
        return;
      }
    }
    update({ dailyGoal: goal, interests });
    setSaving(false);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <HStack className="mt-3 h-11 items-center px-5">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="h-11 flex-1 justify-center">
            <Text className="font-inter text-[16px] text-muted-foreground">Cancel</Text>
          </Pressable>
          <Text accessibilityRole="header" className="flex-1 text-center font-inter-semibold text-[17px] text-foreground">
            Edit profile
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: saving, disabled: saving }}
            disabled={saving}
            onPress={onSave}
            className="h-11 flex-1 items-end justify-center"
          >
            {saving ? (
              <Spinner className="text-brand" />
            ) : (
              <Text className="font-inter-semibold text-[16px] text-brand">Save</Text>
            )}
          </Pressable>
        </HStack>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10">
          <VStack className="mt-5 items-center gap-2.5">
            <Avatar name={name || session?.user.name} size={92} />
          </VStack>

          <VStack className="mt-3 gap-[18px]">
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
            />
            <TextField
              label="Email"
              value={session?.user.email ?? ''}
              placeholder="you@example.com"
              isReadOnly
              helper={
                socialOnly
                  ? `You sign in with ${providerLabel(accounts.socialProvider)}.`
                  : 'Changing it sends a confirmation link to the new address.'
              }
              labelAccessory={
                socialOnly ? undefined : (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Change email"
                    onPress={() => router.push('/profile/change-email')}
                    hitSlop={{ top: 12, bottom: 12, left: 8 }}
                  >
                    <Text className="font-inter-medium text-[14px] text-brand">Change</Text>
                  </Pressable>
                )
              }
            />

            <VStack className="gap-2.5">
              <Text className="font-inter-semibold text-[14px] text-secondary-foreground">Daily goal</Text>
              <SegmentedControl
                accessibilityLabel="Daily goal"
                options={GOAL_OPTIONS}
                value={goal}
                onChange={setGoal}
                className="border border-border bg-card"
              />
            </VStack>

            <VStack className="gap-2.5">
              <Text className="font-inter-semibold text-[14px] text-secondary-foreground">Interests</Text>
              <Box className="flex-row flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <SelectChip
                    key={interest}
                    size="md"
                    label={interest}
                    selected={interests.includes(interest)}
                    onPress={() => toggle(interest)}
                  />
                ))}
              </Box>
            </VStack>
          </VStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
