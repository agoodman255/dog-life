import {
  AloneTimeLog,
  CalendarEvent,
  DailyFeedback,
  Dog,
  ExposureItem,
  GroceryListItem,
  HealthEvent,
  Household,
  InboxRequest,
  InventoryItem,
  JournalEntry,
  Meal,
  Milestone,
  Person,
  ProductFeedback,
  RecipeIngredient,
  RelationshipLog,
  Task,
  TaskInstance,
} from "./types";

// Each entity gets a fromRow (DB snake_case -> app camelCase) and toRow
// (app camelCase -> DB snake_case) pair. toRow takes the current householdId
// since most app-level types don't carry it explicitly (only Dog/Person do) —
// there's exactly one household for now, so the store injects it uniformly
// rather than threading it through every type.

export const household = {
  fromRow(row: any): Household {
    return { id: row.id, name: row.name, memberIds: [], dogIds: [] };
  },
  toRow(item: Household) {
    return { id: item.id, name: item.name };
  },
};

export const person = {
  fromRow(row: any): Person {
    return { id: row.id, householdId: row.household_id, name: row.name, color: row.color };
  },
  toRow(item: Person, householdId: string) {
    return { id: item.id, household_id: householdId, name: item.name, color: item.color };
  },
};

export const dog = {
  fromRow(row: any): Dog {
    return {
      id: row.id,
      householdId: row.household_id,
      name: row.name,
      breed: row.breed,
      birthday: row.birthday,
      sex: row.sex,
      color: row.color,
      weight: row.weight,
      expectedAdultWeight: row.expected_adult_weight,
      weightHistory: row.weight_history ?? [],
      microchip: row.microchip,
      photo: row.photo,
      veterinarian: row.veterinarian,
      insurance: row.insurance,
      breeder: row.breeder,
      healthSummary: row.health_summary,
      medicalHistory: row.medical_history ?? [],
      allergies: row.allergies ?? [],
      medications: row.medications ?? [],
      energy: row.energy,
      confidence: row.confidence,
      fearfulness: row.fearfulness,
      resourceGuarding: row.resource_guarding,
      dogFriendliness: row.dog_friendliness,
      humanFriendliness: row.human_friendliness,
      noiseSensitivity: row.noise_sensitivity,
      favoriteRewards: row.favorite_rewards ?? [],
      favoriteToys: row.favorite_toys ?? [],
      masteredCommands: row.mastered_commands ?? [],
      exerciseNeed: row.exercise_need,
      status: row.status,
    };
  },
  toRow(item: Dog, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      name: item.name,
      breed: item.breed,
      birthday: item.birthday || null,
      sex: item.sex,
      color: item.color,
      weight: item.weight,
      expected_adult_weight: item.expectedAdultWeight,
      weight_history: item.weightHistory,
      microchip: item.microchip,
      photo: item.photo,
      veterinarian: item.veterinarian,
      insurance: item.insurance,
      breeder: item.breeder,
      health_summary: item.healthSummary,
      medical_history: item.medicalHistory,
      allergies: item.allergies,
      medications: item.medications,
      energy: item.energy,
      confidence: item.confidence,
      fearfulness: item.fearfulness,
      resource_guarding: item.resourceGuarding,
      dog_friendliness: item.dogFriendliness,
      human_friendliness: item.humanFriendliness,
      noise_sensitivity: item.noiseSensitivity,
      favorite_rewards: item.favoriteRewards,
      favorite_toys: item.favoriteToys,
      mastered_commands: item.masteredCommands,
      exercise_need: item.exerciseNeed,
      status: item.status,
    };
  },
};

export const task = {
  fromRow(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      assignedTo: row.assigned_to,
      time: row.time,
      duration: row.duration,
      priority: row.priority,
      supplies: row.supplies ?? [],
      setting: row.setting,
      difficulty: row.difficulty,
      dogIds: row.dog_ids ?? [],
      checklist: row.checklist ?? [],
      grizParticipation: row.griz_participation,
      notes: row.notes,
      location: row.location ?? undefined,
      formation: row.formation ?? undefined,
      relatedMilestoneId: row.related_milestone_id ?? undefined,
      checklistSchema: row.checklist_schema ?? undefined,
    };
  },
  toRow(item: Task, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      title: item.title,
      category: item.category,
      assigned_to: item.assignedTo,
      time: item.time,
      duration: item.duration,
      priority: item.priority,
      supplies: item.supplies,
      setting: item.setting,
      difficulty: item.difficulty,
      dog_ids: item.dogIds,
      checklist: item.checklist,
      griz_participation: item.grizParticipation,
      notes: item.notes,
      location: item.location ?? null,
      formation: item.formation ?? null,
      related_milestone_id: item.relatedMilestoneId ?? null,
      checklist_schema: item.checklistSchema ?? null,
    };
  },
};

export const milestone = {
  fromRow(row: any): Milestone {
    return {
      id: row.id,
      title: row.title,
      track: row.track,
      dogIds: row.dog_ids ?? [],
      status: row.status,
      dependencies: row.dependencies ?? [],
      ageGateWeeks: row.age_gate_weeks ?? undefined,
      steps: row.steps ?? [],
      sources: row.sources ?? [],
      why: row.why,
    };
  },
  toRow(item: Milestone, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      title: item.title,
      track: item.track,
      dog_ids: item.dogIds,
      status: item.status,
      dependencies: item.dependencies,
      age_gate_weeks: item.ageGateWeeks ?? null,
      steps: item.steps,
      sources: item.sources,
      why: item.why,
    };
  },
};

export const healthEvent = {
  fromRow(row: any): HealthEvent {
    return { id: row.id, dogId: row.dog_id, title: row.title, date: row.date, kind: row.kind, notes: row.notes };
  },
  toRow(item: HealthEvent, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      dog_id: item.dogId,
      title: item.title,
      date: item.date,
      kind: item.kind,
      notes: item.notes,
    };
  },
};

export const journalEntry = {
  fromRow(row: any): JournalEntry {
    return {
      id: row.id,
      dogIds: row.dog_ids ?? [],
      date: row.date,
      title: row.title,
      text: row.text,
      tags: row.tags ?? [],
      mood: row.mood,
    };
  },
  toRow(item: JournalEntry, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      dog_ids: item.dogIds,
      date: item.date,
      title: item.title,
      text: item.text,
      tags: item.tags,
      mood: item.mood,
    };
  },
};

export const exposureItem = {
  fromRow(row: any): ExposureItem {
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      dogIds: row.dog_ids ?? [],
      status: row.status,
      log: row.log ?? [],
    };
  },
  toRow(item: ExposureItem, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      category: item.category,
      title: item.title,
      dog_ids: item.dogIds,
      status: item.status,
      log: item.log,
    };
  },
};

export const relationshipLog = {
  fromRow(row: any): RelationshipLog {
    return {
      id: row.id,
      dogIds: row.dog_ids ?? [],
      date: row.date,
      comfort: row.comfort,
      sharedToys: row.shared_toys,
      sharedBeds: row.shared_beds,
      sharedWalks: row.shared_walks,
      bodyLanguage: row.body_language,
      resourceGuarding: row.resource_guarding,
      playQuality: row.play_quality,
      corrections: row.corrections,
      recoveryMinutes: row.recovery_minutes,
      notes: row.notes,
    };
  },
  toRow(item: RelationshipLog, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      dog_ids: item.dogIds,
      date: item.date,
      comfort: item.comfort,
      shared_toys: item.sharedToys,
      shared_beds: item.sharedBeds,
      shared_walks: item.sharedWalks,
      body_language: item.bodyLanguage,
      resource_guarding: item.resourceGuarding,
      play_quality: item.playQuality,
      corrections: item.corrections,
      recovery_minutes: item.recoveryMinutes,
      notes: item.notes,
    };
  },
};

// Feedback is keyed by (household_id, task_id) rather than its own app-level
// id — the app treats it as "current completion state per task," not a log.
export const feedback = {
  fromRow(row: any): DailyFeedback {
    return {
      taskId: row.task_id,
      completed: row.completed,
      rating: row.rating,
      mood: row.mood,
      successScore: row.success_score,
      notes: row.notes,
      accident: row.accident,
      barking: row.barking,
      fear: row.fear,
      guarding: row.guarding,
      completedAt: row.completed_at,
    };
  },
  toRow(item: DailyFeedback, householdId: string) {
    return {
      household_id: householdId,
      task_id: item.taskId,
      completed: item.completed,
      rating: item.rating,
      mood: item.mood,
      success_score: item.successScore,
      notes: item.notes,
      accident: item.accident,
      barking: item.barking,
      fear: item.fear,
      guarding: item.guarding,
      completed_at: item.completedAt,
    };
  },
};

export const calendarEvent = {
  fromRow(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      kind: row.kind,
      dayOfWeek: row.day_of_week ?? undefined,
      activeFrom: row.active_from ?? undefined,
      activeTo: row.active_to ?? undefined,
      date: row.date ?? undefined,
      windowLabel: row.window_label,
      timeLabel: row.time_label,
      durationHours: row.duration_hours ?? undefined,
      coverageNeeded: row.coverage_needed,
      status: row.status,
      importance: row.importance ?? undefined,
      notes: row.notes,
      attendees: row.attendees ?? undefined,
      roverVisits: row.rover_visits ?? undefined,
      prepSteps: row.prep_steps ?? undefined,
      roverInstructions: row.rover_instructions ?? undefined,
      postSteps: row.post_steps ?? undefined,
    };
  },
  toRow(item: CalendarEvent, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      title: item.title,
      category: item.category,
      kind: item.kind,
      day_of_week: item.dayOfWeek ?? null,
      active_from: item.activeFrom || null,
      active_to: item.activeTo || null,
      date: item.date || null,
      window_label: item.windowLabel,
      time_label: item.timeLabel,
      duration_hours: item.durationHours ?? null,
      coverage_needed: item.coverageNeeded,
      status: item.status,
      importance: item.importance ?? null,
      notes: item.notes,
      attendees: item.attendees ?? [],
      rover_visits: item.roverVisits ?? null,
      prep_steps: item.prepSteps ?? [],
      rover_instructions: item.roverInstructions ?? [],
      post_steps: item.postSteps ?? [],
    };
  },
};

export const aloneTimeLog = {
  fromRow(row: any): AloneTimeLog {
    return { id: row.id, date: row.date, durationMinutes: row.duration_minutes, notes: row.notes };
  },
  toRow(item: AloneTimeLog, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      date: item.date,
      duration_minutes: item.durationMinutes,
      notes: item.notes,
    };
  },
};

export const taskInstance = {
  fromRow(row: any): TaskInstance {
    return {
      id: row.id,
      templateId: row.template_id,
      originalDate: row.original_date,
      date: row.date,
      state: row.state,
      assignedTo: row.assigned_to,
      originalAssignedTo: row.original_assigned_to,
      scheduledTime: row.scheduled_time,
      startTime: row.start_time ?? undefined,
      startTimeZone: row.start_time_zone ?? undefined,
      endTime: row.end_time ?? undefined,
      endTimeZone: row.end_time_zone ?? undefined,
      rating: row.rating ?? undefined,
      checklist: row.checklist ?? [],
      history: row.history ?? [],
    };
  },
  toRow(item: TaskInstance, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      template_id: item.templateId,
      original_date: item.originalDate,
      date: item.date,
      state: item.state,
      assigned_to: item.assignedTo,
      original_assigned_to: item.originalAssignedTo,
      scheduled_time: item.scheduledTime,
      start_time: item.startTime ?? null,
      start_time_zone: item.startTimeZone ?? null,
      end_time: item.endTime ?? null,
      end_time_zone: item.endTimeZone ?? null,
      rating: item.rating ?? null,
      checklist: item.checklist,
      history: item.history,
    };
  },
};

export const inboxRequest = {
  fromRow(row: any): InboxRequest {
    return {
      id: row.id,
      taskInstanceId: row.task_instance_id,
      fromPersonId: row.from_person_id,
      toPersonId: row.to_person_id,
      status: row.status,
      createdAt: row.created_at,
      respondedAt: row.responded_at ?? undefined,
    };
  },
  toRow(item: InboxRequest, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      task_instance_id: item.taskInstanceId,
      from_person_id: item.fromPersonId,
      to_person_id: item.toPersonId,
      status: item.status,
      created_at: item.createdAt,
      responded_at: item.respondedAt ?? null,
    };
  },
};

export const meal = {
  fromRow(row: any): Meal {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      source: row.source,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      plannedDate: row.planned_date ?? undefined,
    };
  },
  toRow(item: Meal, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      name: item.name,
      description: item.description,
      source: item.source,
      prep_minutes: item.prepMinutes,
      cook_minutes: item.cookMinutes,
      planned_date: item.plannedDate || null,
    };
  },
};

export const recipeIngredient = {
  fromRow(row: any): RecipeIngredient {
    return {
      id: row.id,
      mealId: row.meal_id,
      ingredientName: row.ingredient_name,
      quantity: row.quantity,
      unit: row.unit,
    };
  },
  toRow(item: RecipeIngredient, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      meal_id: item.mealId,
      ingredient_name: item.ingredientName,
      quantity: item.quantity,
      unit: item.unit,
    };
  },
};

export const inventoryItem = {
  fromRow(row: any): InventoryItem {
    return {
      id: row.id,
      itemName: row.item_name,
      category: row.category,
      location: row.location,
      quantity: row.quantity,
      unit: row.unit,
      purchaseDate: row.purchase_date,
      estimatedExpirationDate: row.estimated_expiration_date,
    };
  },
  toRow(item: InventoryItem, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      item_name: item.itemName,
      category: item.category,
      location: item.location,
      quantity: item.quantity,
      unit: item.unit,
      purchase_date: item.purchaseDate,
      estimated_expiration_date: item.estimatedExpirationDate,
    };
  },
};

export const groceryListItem = {
  fromRow(row: any): GroceryListItem {
    return {
      id: row.id,
      itemName: row.item_name,
      quantityNeeded: row.quantity_needed,
      unit: row.unit,
      linkedMealIds: row.linked_meal_ids ?? [],
      status: row.status,
    };
  },
  toRow(item: GroceryListItem, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      item_name: item.itemName,
      quantity_needed: item.quantityNeeded,
      unit: item.unit,
      linked_meal_ids: item.linkedMealIds,
      status: item.status,
    };
  },
};

export const productFeedback = {
  fromRow(row: any): ProductFeedback {
    return {
      id: row.id,
      page: row.page,
      feedbackType: row.feedback_type,
      authorEmail: row.author_email,
      locationNote: row.location_note,
      message: row.message,
      createdAt: row.created_at,
    };
  },
  toRow(item: ProductFeedback, householdId: string) {
    return {
      id: item.id,
      household_id: householdId,
      page: item.page,
      feedback_type: item.feedbackType,
      author_email: item.authorEmail,
      location_note: item.locationNote,
      message: item.message,
      created_at: item.createdAt,
    };
  },
};
