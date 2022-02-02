import { Injectable } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { ExploreEntity } from "src/app/core/models/business-process-srcreen-models/business-process-screen-entity.model";
import { BusinessProcessScreenSummaryItem } from "src/app/core/models/business-process-srcreen-models/business-process-screen-summary-item.model";
import { Location } from "src/app/core/models/locations/location.model";
import {
  getAllLocationsFromTree,
  getCitiesFromLocationTreeBranch,
  getLocationsTree,
} from "src/app/core/services/locations.tools";

@Injectable({
  providedIn: "root",
})
export class ExploreEntitySummaryCreatorService {
  constructor(private translate: TranslateService) {}

  setSummaryInformation(
    steps: ExploreEntity[],
    businessProcesses: ExploreEntity[],
    groups: ExploreEntity[],
    allLocations: Location[]
  ) {
    const locationTree = getLocationsTree(allLocations);
    businessProcesses.forEach(businessProcessEntity => {
      this.setEntitySummary(
        locationTree,
        businessProcessEntity,
        steps,
        businessProcesses,
        groups,
        allLocations
      );
    });

    steps.forEach(businessProcessEntity => {
      this.setEntitySummary(
        locationTree,
        businessProcessEntity,
        steps,
        businessProcesses,
        groups,
        allLocations
      );
    });

    groups.forEach(businessProcessEntity => {
      this.setEntitySummary(
        locationTree,
        businessProcessEntity,
        steps,
        businessProcesses,
        groups,
        allLocations
      );
    });
  }

  private setEntitySummary(
    locationTree: Location[],
    entity: ExploreEntity,
    steps: ExploreEntity[],
    businessProcesses: ExploreEntity[],
    groups: ExploreEntity[],
    allLocations: Location[]
  ) {
    entity.maxSummaryItems = 0;

    const summaryVariables = this.getSummaryVariables(
      locationTree,
      entity,
      steps,
      businessProcesses,
      groups
    );

    const scopeSummary = this.getScope(
      summaryVariables.locationsLinked,
      summaryVariables.totalLocations,
      entity,
      allLocations,
      businessProcesses
    );
    if (scopeSummary) entity.summary.push(scopeSummary);

    const relevanceSummary = this.getRelevance(
      summaryVariables.numberOfUsersLinked,
      summaryVariables.avgNumberOfUsers,
      entity
    );
    if (relevanceSummary) entity.summary.push(relevanceSummary);

    const homogeneitySummary = this.getHomogeneity(entity, steps, allLocations);
    if (homogeneitySummary) entity.summary.push(homogeneitySummary);

    const automatizationSummary = this.getAutomatization(
      entity,
      steps,
      businessProcesses
    );
    if (automatizationSummary) entity.summary.push(automatizationSummary);

    const codeQualitySummary = this.getCodeQuality(entity, steps);
    if (codeQualitySummary) entity.summary.push(codeQualitySummary);

    const securitySummary = this.getSecurity(entity, steps);
    if (securitySummary) entity.summary.push(securitySummary);
  }

  private getSummaryVariables(
    locationTree: Location[],
    entity: ExploreEntity,
    steps: ExploreEntity[],
    businessProcesses: ExploreEntity[],
    groups: ExploreEntity[]
  ) {
    const totalLocations = getCitiesFromLocationTreeBranch(
      locationTree,
      entity.locationId
    ).length;
    const locationsLinked = entity.numberOfLocations;

    let entitiesInSameLocation: ExploreEntity[] = [];
    if (entity.entityType == "business_process")
      entitiesInSameLocation = businessProcesses.filter(
        bp => bp.locationId == entity.locationId
      );
    else if (entity.entityType == "step")
      entitiesInSameLocation = steps.filter(
        bp => bp.locationId == entity.locationId
      );
    else if (entity.entityType == "group")
      entitiesInSameLocation = groups.filter(
        bp => bp.locationId == entity.locationId
      );

    const totalNumberOfUsers = entitiesInSameLocation
      .map(b => b.numberOfUsers)
      .reduce((a, b) => a + b, 0);

    const numberOfUsersLinked = entity.numberOfUsers;

    const avgNumberOfUsers = totalNumberOfUsers / entitiesInSameLocation.length;

    return {
      totalLocations,
      locationsLinked,
      totalNumberOfUsers,
      numberOfUsersLinked,
      avgNumberOfUsers,
    };
  }

  private getSecurity(
    entity: ExploreEntity,
    steps: ExploreEntity[]
  ): BusinessProcessScreenSummaryItem {
    entity.maxSummaryItems++;
    if (!steps || !steps.length || !entity.mapLocations) return;

    const implementationLocationsIds = entity.mapLocations.map(l => l.id);

    const implementationSteps = steps.filter(
      s =>
        ((entity.entityType == "business_process" &&
          s.businessProcessId == entity.businessProcessId) ||
          (entity.entityType == "step" &&
            s.businessStepId == entity.businessStepId) ||
          (entity.entityType == "group" &&
            s.businessProcessClass == entity.businessProcessClass)) &&
        implementationLocationsIds.indexOf(s.locationId) > -1 &&
        s.functionalAreaId
    );

    if (!implementationSteps.length) return;

    const rateWeighted = implementationSteps.reduce(
      (a, b) => b.numberOfUsers * (b.securityRate ?? 0) + a,
      0
    );
    const totalUsers = implementationSteps.reduce(
      (a, b) => a + b.numberOfUsers,
      0
    );

    const avgRating = rateWeighted / totalUsers;
    const maxRatingStep = implementationSteps.sort(
      (a, b) => (b.securityRate ?? 0) - (a.securityRate ?? 0)
    )[0];

    const minRatingStep = implementationSteps.sort(
      (a, b) => (a.securityRate ?? 0) - (b.securityRate ?? 0)
    )[0];

    let descriptionKey = "";
    let scoreKey = "";
    if (avgRating > 0.833) {
      descriptionKey = "business_process_summary__security_gt_83";
      scoreKey = "general__very-high";
    } else if (avgRating > 0.75) {
      descriptionKey = "business_process_summary__security_gt_75";
      scoreKey = "general__high";
    } else if (avgRating > 0.583) {
      descriptionKey = "business_process_summary__security_gt_58";
      scoreKey = "general__high";
    } else if (avgRating > 0.333) {
      descriptionKey = "business_process_summary__security_gt_33";
      scoreKey = "general__medium";
    } else if (avgRating > 0.167) {
      descriptionKey = "business_process_summary__security_gt_16";
      scoreKey = "general__low";
    } else {
      descriptionKey = "business_process_summary__security_lt_16";
      scoreKey = "general__very-low";
    }

    let { entityName, entityNamePlural } = this.getEntityNameAndPlural(entity);

    return {
      id: "security",
      score: avgRating,
      scoreKey: scoreKey,
      titleKey: "business_process_summary__security_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        entityName,
        entityNamePlural,
        avgRating: Math.round(avgRating * 100 * 100) / 100,
        bestSoftwareName: maxRatingStep.applicationName,
        bestRating: Math.round(maxRatingStep.securityRate * 100 * 100) / 100,
        worstSoftwareName: minRatingStep.applicationName,
        worstRating: Math.round(minRatingStep.securityRate * 100 * 100) / 100,
      },
    };
  }

  private getCodeQuality(
    entity: ExploreEntity,
    steps: ExploreEntity[]
  ): BusinessProcessScreenSummaryItem {
    const implementationLocationsIds = (entity?.mapLocations ?? [])
      .filter(l => l.isSelected)
      .map(l => l.id);

    let implementationSteps = steps.filter(
      s =>
        ((entity.entityType == "business_process" &&
          s.businessProcessId == entity.businessProcessId) ||
          (entity.entityType == "step" &&
            s.businessStepId == entity.businessStepId) ||
          (entity.entityType == "group" &&
            s.businessProcessClass == entity.businessProcessClass)) &&
        implementationLocationsIds.indexOf(s.locationId) > -1
    );

    //if there are implementation steps but all are manual or all belong to not analyzed apps, dont increment
    //the maxSummaryItems as nothing can be done in enrichment to make this summary item appear
    if (
      implementationSteps.length &&
      (steps.every(s => s.isManualStep) ||
        steps.every(s => !s.functionalAreaId))
    )
      return;

    entity.maxSummaryItems++;

    implementationSteps = implementationSteps.filter(s => s.functionalAreaId);

    if (!implementationSteps.length) return;

    const rateWeighted = implementationSteps.reduce(
      (a, b) => b.numberOfUsers * (b.technologyRate ?? 0) + a,
      0
    );
    const totalUsers = implementationSteps.reduce(
      (a, b) => a + b.numberOfUsers,
      0
    );

    const avgRating = rateWeighted / totalUsers;
    const maxRatingStep = implementationSteps.sort(
      (a, b) => (b.technologyRate ?? 0) - (a.technologyRate ?? 0)
    )[0];

    const minRatingStep = implementationSteps.sort(
      (a, b) => (a.technologyRate ?? 0) - (b.technologyRate ?? 0)
    )[0];

    let descriptionKey = "";
    let scoreKey = "";
    if (avgRating > 0.833) {
      descriptionKey = "business_process_summary__codequality_gt_83";
      scoreKey = "general__very-high";
    } else if (avgRating > 0.75) {
      descriptionKey = "business_process_summary__codequality_gt_75";
      scoreKey = "general__high";
    } else if (avgRating > 0.583) {
      descriptionKey = "business_process_summary__codequality_gt_58";
      scoreKey = "general__high";
    } else if (avgRating > 0.333) {
      descriptionKey = "business_process_summary__codequality_gt_33";
      scoreKey = "general__medium";
    } else if (avgRating > 0.167) {
      descriptionKey = "business_process_summary__codequality_gt_16";
      scoreKey = "general__low";
    } else {
      descriptionKey = "business_process_summary__codequality_lt_16";
      scoreKey = "general__very-low";
    }

    let { entityName, entityNamePlural } = this.getEntityNameAndPlural(entity);

    return {
      id: "code_quality",
      score: avgRating,
      scoreKey: scoreKey,
      titleKey: "business_process_summary__codequality_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        entityName,
        entityNamePlural,
        avgRating: Math.round(avgRating * 100 * 100) / 100,
        bestSoftwareName: maxRatingStep.applicationName,
        bestRating: Math.round(maxRatingStep.technologyRate * 100 * 100) / 100,
        worstSoftwareName: minRatingStep.applicationName,
        worstRating: Math.round(minRatingStep.technologyRate * 100 * 100) / 100,
      },
    };
  }

  private getAutomatization(
    entity: ExploreEntity,
    steps: ExploreEntity[],
    businessProcesses: ExploreEntity[]
  ): BusinessProcessScreenSummaryItem {
    entity.maxSummaryItems++;
    if (!entity.mapLocations) return;
    const implementationLocationsIds = entity.mapLocations.map(l => l.id);

    let implementationSteps: ExploreEntity[] = null;
    if (entity.entityType == "group") {
      const groupBusinessProcessesIds = businessProcesses
        .filter(b =>
          b.businessProcessClass.startsWith(entity.businessProcessClass)
        )
        .map(b => b.businessProcessId);

      implementationSteps = steps.filter(
        s =>
          groupBusinessProcessesIds.includes(entity.businessProcessId) &&
          implementationLocationsIds.indexOf(s.locationId) > -1
      );
    } else if (entity.entityType == "business_process") {
      implementationSteps = steps.filter(
        s =>
          s.businessProcessId == entity.businessProcessId &&
          implementationLocationsIds.indexOf(s.locationId) > -1
      );
    } else if (entity.entityType == "step") {
      implementationSteps = steps.filter(
        s =>
          s.businessStepId == entity.businessStepId &&
          implementationLocationsIds.indexOf(s.locationId) > -1
      );
    }

    if (!implementationSteps.length) return;

    const automatedSteps = implementationSteps.filter(
      s => !s.isManualStep
    ).length;

    const automatizationPct = automatedSteps / implementationSteps.length;

    let descriptionKey = "";
    let scoreKey = "";
    if (automatizationPct == 1) {
      descriptionKey = "business_process_summary__automatization_100";
      scoreKey = "general__very-high";
    } else if (automatizationPct > 0.85) {
      descriptionKey = "business_process_summary__automatization_gt_85";
      scoreKey = "general__very-high";
    } else if (automatizationPct > 0.6) {
      descriptionKey = "business_process_summary__automatization_gt_60";
      scoreKey = "general__high";
    } else if (automatizationPct > 0.4) {
      descriptionKey = "business_process_summary__automatization_gt_40";
      scoreKey = "general__medium";
    } else if (automatizationPct > 0.15) {
      descriptionKey = "business_process_summary__automatization_gt_15";
      scoreKey = "general__low";
    } else if (automatizationPct > 0) {
      descriptionKey = "business_process_summary__automatization_gt_0";
      scoreKey = "general__very-low";
    } else {
      descriptionKey = "business_process_summary__automatization_0";
      scoreKey = "general__very-low";
    }

    let { entityName, entityNamePlural } = this.getEntityNameAndPlural(entity);

    return {
      id: "automatization",
      score: automatizationPct,
      scoreKey: scoreKey,
      titleKey: "business_process_summary__automatization_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        automatizationPct: Math.round(automatizationPct * 100 * 100) / 100,
        entityName,
        entityNamePlural,
      },
    };
  }

  private getHomogeneity(
    entity: ExploreEntity,
    steps: ExploreEntity[],
    allLocations: Location[]
  ): BusinessProcessScreenSummaryItem {
    if (this.isImplementationLocation(entity.locationId, allLocations)) return;

    entity.maxSummaryItems++;

    if (!entity.mapLocations) return;
    const implementationLocationsIds = entity.mapLocations.map(l => l.id);

    const businessProcessImplementationSteps = steps.filter(
      s =>
        s.businessProcessId == entity.businessProcessId &&
        implementationLocationsIds.indexOf(s.locationId) > -1
    );

    if (!businessProcessImplementationSteps.length) return;

    const allStepsIds = [
      ...new Set(businessProcessImplementationSteps.map(b => b.businessStepId)),
    ];

    let totalAppVariationByStep = 0;
    let totalnumberOfLocationByStep = 0;
    allStepsIds.forEach(stepId => {
      const stepImplementations = businessProcessImplementationSteps.filter(
        s => s.businessStepId == stepId && !s.isManualStep
      );

      const appVariationByStep = Math.max(
        0,
        [...new Set(stepImplementations.map(s => s.applicationSourceId))]
          .length - 1
      );

      const numberOfLocationsByStep = stepImplementations.length;

      totalAppVariationByStep += appVariationByStep;
      totalnumberOfLocationByStep += numberOfLocationsByStep;
    });

    const heterogeneityPct =
      totalAppVariationByStep / totalnumberOfLocationByStep;

    let descriptionKey = "";
    let scoreKey = "";
    if (heterogeneityPct == 1) {
      descriptionKey = "business_process_summary__heterogeneity_100";
      scoreKey = "general__very-low";
    } else if (heterogeneityPct > 0.85) {
      descriptionKey = "business_process_summary__heterogeneity_gt_85";
      scoreKey = "general__very-low";
    } else if (heterogeneityPct > 0.6) {
      descriptionKey = "business_process_summary__heterogeneity_gt_60";
      scoreKey = "general__low";
    } else if (heterogeneityPct > 0.4) {
      descriptionKey = "business_process_summary__heterogeneity_gt_40";
      scoreKey = "general__medium";
    } else if (heterogeneityPct > 0.15) {
      descriptionKey = "business_process_summary__heterogeneity_gt_15";
      scoreKey = "general__high";
    } else if (heterogeneityPct > 0) {
      descriptionKey = "business_process_summary__heterogeneity_gt_0";
      scoreKey = "general__very-high";
    } else {
      descriptionKey = "business_process_summary__heterogeneity_0";
      scoreKey = "general__very-high";
    }

    let { entityName, entityNamePlural } = this.getEntityNameAndPlural(entity);

    return {
      id: "homogeneity",
      score: Math.max(0, 1 - heterogeneityPct),
      scoreKey: scoreKey,
      titleKey: "business_process_summary__homogeneity_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        heterogeneityPct: Math.round(heterogeneityPct * 100 * 100) / 100,
        entityName,
        entityNamePlural,
      },
    };
  }

  private getRelevance(
    numberOfUsersLinked: number,
    avgNumberOfUsers: number,
    entity: ExploreEntity
  ): BusinessProcessScreenSummaryItem {
    entity.maxSummaryItems++;

    if (!numberOfUsersLinked && !avgNumberOfUsers) return;

    let { entityName, entityNamePlural } = this.getEntityNameAndPlural(entity);
    const numberOfUsersText = this.translate.instant(
      "business_process_summary__relevance_numberOfUsersText",
      {
        numberOfUsersLinked,
        avgNumberOfUsers: Math.round(avgNumberOfUsers),
        entityName,
      }
    );

    let descriptionKey = "";
    let scoreKey = "";
    if (numberOfUsersLinked > 2 * avgNumberOfUsers) {
      descriptionKey = "business_process_summary__relevance_gt_2";
      scoreKey = "general__very-high";
    } else if (numberOfUsersLinked > 1.8 * avgNumberOfUsers) {
      descriptionKey = "business_process_summary__relevance_gt_1.8";
      scoreKey = "general__high";
    } else if (numberOfUsersLinked > 1.2 * avgNumberOfUsers) {
      descriptionKey = "business_process_summary__relevance_gt_1.2";
      scoreKey = "general__high";
    } else if (numberOfUsersLinked > 0.8 * avgNumberOfUsers) {
      descriptionKey = "business_process_summary__relevance_gt_0.8";
      scoreKey = "general__medium";
    } else if (numberOfUsersLinked > 0.5 * avgNumberOfUsers) {
      descriptionKey = "business_process_summary__relevance_gt_0.5";
      scoreKey = "general__low";
    } else {
      descriptionKey = "business_process_summary__relevance_lt_0.5";
      scoreKey = "general__very-low";
    }

    const score = Math.min(numberOfUsersLinked / avgNumberOfUsers, 2) / 2;

    return {
      id: "relevance",
      score: score,
      scoreKey: scoreKey,
      titleKey: "business_process_summary__relevance_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        numberOfUsersText,
        entityName,
        entityNamePlural,
      },
    };
  }

  private getScope(
    locationsLinked: number,
    totalLocations: number,
    entity: ExploreEntity,
    allLocations: Location[],
    businessProcesses: ExploreEntity[]
  ): BusinessProcessScreenSummaryItem {
    if (this.isImplementationLocation(entity.locationId, allLocations)) return;

    entity.maxSummaryItems++;

    if (!locationsLinked && !totalLocations) return;

    if (entity.entityType == "group")
      return this.getScopeForGroups(
        locationsLinked,
        totalLocations,
        allLocations,
        entity,
        businessProcesses
      );
    else
      return this.getScopeForBusinessProcessAndSteps(
        locationsLinked,
        totalLocations,
        allLocations,
        entity
      );
  }

  private getScopeForBusinessProcessAndSteps(
    locationsLinked: number,
    totalLocations: number,
    allLocations: Location[],
    entity: ExploreEntity
  ) {
    const spreadPct = locationsLinked / totalLocations;
    const numberOfLocationsText = this.translate.instant(
      "business_process_summary__scope_numberOfLocationsText",
      {
        locationsLinked,
        totalLocations,
      }
    );

    let descriptionKey = "";
    let scoreKey = "";
    if (spreadPct == 1) {
      descriptionKey = "business_process_summary__scope_100";
      scoreKey = "general__very-high";
    } else if (spreadPct > 0.85) {
      descriptionKey = "business_process_summary__scope_gt_85";
      scoreKey = "general__very-high";
    } else if (spreadPct > 0.6) {
      descriptionKey = "business_process_summary__scope_gt_60";
      scoreKey = "general__high";
    } else if (spreadPct > 0.4) {
      descriptionKey = "business_process_summary__scope_gt_40";
      scoreKey = "general__medium";
    } else if (spreadPct > 0.15) {
      descriptionKey = "business_process_summary__scope_gt_15";
      scoreKey = "general__low";
    } else if (spreadPct > 0) {
      descriptionKey = "business_process_summary__scope_gt_0";
      scoreKey = "general__very-low";
    } else {
      descriptionKey = "business_process_summary__scope_0";
      scoreKey = "general__very-low";
    }

    const location = allLocations.find(l => l.id == entity.locationId);
    let topRegionLocs: Location[] = [location];
    if (location.path == "" || location.path == null) {
      topRegionLocs = getAllLocationsFromTree(entity.locationsTree).filter(
        l => l.path == "/"
      );
    }

    const topRegionLinked = topRegionLocs.map(l => l.name).join(", ");

    return {
      id: "scope",
      score: spreadPct,
      scoreKey: scoreKey,
      titleKey: "business_process_summary__scope_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        topRegionLinked: topRegionLinked,
        numberOfLocationsText: numberOfLocationsText,
      },
    };
  }

  private getScopeForGroups(
    locationsLinked: number,
    totalLocations: number,
    allLocations: Location[],
    entity: ExploreEntity,
    businessProcesses: ExploreEntity[]
  ) {
    const spreadPct = locationsLinked / totalLocations;
    const numberOfLocationsText = this.translate.instant(
      "business_process_summary__scope_numberOfLocationsText",
      {
        locationsLinked,
        totalLocations,
      }
    );

    const groupBusinessProcesses = businessProcesses.filter(
      b =>
        b.locationId == entity.locationId &&
        b.businessProcessClass.startsWith(entity.businessProcessClass)
    );

    let locationsImplementedInAllGroupBusinessProcess =
      groupBusinessProcesses.length
        ? groupBusinessProcesses[0].mapLocations.map(l => l.id)
        : [];
    groupBusinessProcesses.forEach(businessProcess => {
      const bbppLocationsIds = businessProcess.mapLocations.map(l => l.id);

      //intersection
      locationsImplementedInAllGroupBusinessProcess =
        locationsImplementedInAllGroupBusinessProcess.filter(value =>
          bbppLocationsIds.includes(value)
        );
    });

    const fullSpreadPct =
      locationsImplementedInAllGroupBusinessProcess.length / totalLocations;

    let descriptionKey = "";
    let scoreKey = "";
    if (spreadPct == 1) {
      descriptionKey = "business_process_summary__scope_group_100";
      scoreKey = "general__very-high";
    } else if (spreadPct > 0.85) {
      descriptionKey = "business_process_summary__scope_group_gt_85";
      scoreKey = "general__very-high";
    } else if (spreadPct > 0.6) {
      descriptionKey = "business_process_summary__scope_group_gt_60";
      scoreKey = "general__high";
    } else if (spreadPct > 0.4) {
      descriptionKey = "business_process_summary__scope_group_gt_40";
      scoreKey = "general__medium";
    } else if (spreadPct > 0.15) {
      descriptionKey = "business_process_summary__scope_group_gt_15";
      scoreKey = "general__low";
    } else if (spreadPct > 0) {
      descriptionKey = "business_process_summary__scope_group_gt_0";
      scoreKey = "general__very-low";
    } else {
      descriptionKey = "business_process_summary__scope_group_0";
      scoreKey = "general__very-low";
    }

    const location = allLocations.find(l => l.id == entity.locationId);
    let topRegionLocs: Location[] = [location];
    if (location.path == "" || location.path == null) {
      topRegionLocs = allLocations.filter(l => l.path == "/");
    }

    const topRegionLinked = topRegionLocs.map(l => l.name).join(", ");

    return {
      id: "scope",
      score: spreadPct,
      scoreKey: scoreKey,
      titleKey: "business_process_summary__scope_title",
      descriptionKey: descriptionKey,
      descriptionParams: {
        topRegionLinked: topRegionLinked,
        numberOfLocationsText: numberOfLocationsText,
        fullSpreadPct: Math.round(fullSpreadPct * 100 * 100) / 100,
      },
    };
  }

  private getEntityNameAndPlural(entity: ExploreEntity) {
    let entityName = "";
    let entityNamePlural = "";
    switch (entity.entityType) {
      case "business_process":
        entityName = this.translate.instant("general__business_process");
        entityNamePlural = this.translate.instant(
          "general__business_processes"
        );
        break;
      case "group":
        entityName = this.translate.instant("general__business_process_group");
        entityNamePlural = this.translate.instant(
          "general__business_process_groups"
        );
        break;
      case "step":
        entityName = this.translate.instant("general__business_process_step");
        entityNamePlural = this.translate.instant(
          "general__business_process_steps"
        );
    }
    return { entityName, entityNamePlural };
  }

  private isImplementationLocation(
    locationId: number,
    allLocations: Location[]
  ) {
    const loc = allLocations.find(l => l.id == locationId);
    return loc && !loc.isRegion;
  }
}
