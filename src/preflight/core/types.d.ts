export type Vertical = 'obs' | 'studio' | 'blender' | 'godot';
export type ComponentStatus = 'READY' | 'UPDATE_REQUIRED' | 'CAUTION' | 'LEGACY' | 'UNKNOWN' | 'BLOCKED' | 'DEPRECATED' | 'NOT_APPLICABLE';
export type Verdict = 'READY' | 'CAUTION' | 'WAIT' | 'BLOCKED';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Platform = 'windows' | 'macos' | 'linux';
export type Architecture = 'x86_64' | 'arm64' | 'x86' | 'universal';
export interface Reason {code:string; args?:Record<string,string|number>; detail?:string}
export interface Dependency {componentId:string; versionRange?:string; optional?:boolean}
export interface PreflightComponent {
 id:string; name:string; vendor?:string; category:string; version?:string; critical:boolean;
 ignored?:boolean; sample?:boolean; platform?:Platform; architecture?:Architecture; native?:boolean;
 installPath?:string; installType?:string; builtForHost?:string; dependencies?:Dependency[];
}
export interface PreflightTarget {
 version:string; platform:Platform; architecture:Architecture; osVersion?:string;
 renderer?:string; language?:string; daw?:string; formats?:string[]; runtimes?:Record<string,string>;
}
export interface PreflightEnvironment {
 schemaVersion:1; vertical:Vertical; name:string; generatedAt:string; sample:boolean;
 platform:Platform; architecture:Architecture; host:{name:string; version:string};
 components:PreflightComponent[]; target?:PreflightTarget;
}
export interface CompatibilityEvidence {
 sourceType:'vendor'|'release_notes'|'repository'|'verified_community'|'community'|'inference'|'sample';
 title:string; url?:string; checkedAt:string; quoteSummary:string;
 sourcePublishedAt?:string; sourceUpdatedAt?:string;
}
export interface BreakingChange {
 id:string; targetVersionRange:string; description:string; resolution?:string; hard?:boolean;
 evidence:CompatibilityEvidence[];
}
export interface Requirements {
 host?:string; os?:string; component?:string; renderer?:string[]; language?:string[];
 daw?:string[];
 formats?:string[]; runtimes?:Record<string,string>; nativeMode?:'native'|'rosetta'|'intel';
}
export interface CompatibilityRecord {
 id:string; componentId:string; componentName:string; vendor:string; componentType:string;
 platform:Platform[]; architecture:Architecture[]; host:string; hostVersionRange:string;
 componentVersionRange?:string; compatibilityStatus:ComponentStatus;
 minimumVersion?:string; recommendedVersion?:string; maximumTestedVersion?:string;
 notes:string; requiredAction?:string; dependencies:Dependency[]; knownIssues:string[];
 breakingChanges:BreakingChange[]; evidence:CompatibilityEvidence[]; lastVerifiedAt:string;
 requirements?:Requirements; sample:boolean; hardBlocker?:boolean;
 installationTypes?:string[];
}
export interface CatalogEntry {
 id:string; name:string; vendor:string; category:string; aliases:string[]; vendorUrl?:string;
 critical?:boolean; sample?:boolean;
}
export interface Finding {status:ComponentStatus; reason:Reason; evidence:CompatibilityEvidence[]; action?:string; hard?:boolean; unresolved?:boolean}
export interface Adapter {
 id:Vertical; host:string; icon:string; defaultCurrent:string; defaultTarget:string;
 hosts?:Partial<Record<Platform,string>>;
 categories:string[]; defaultPlatform:Platform; defaultArchitecture:Architecture;
 normalizeComponent:(c:PreflightComponent)=>PreflightComponent;
 inspect?:(c:PreflightComponent,e:PreflightEnvironment,t:PreflightTarget)=>Finding[];
 backup:string; verify:string;
}
export interface CompatibilityDatabase {records:CompatibilityRecord[]; catalog:CatalogEntry[]}
export interface CompatibilityResult {
 component:PreflightComponent; status:ComponentStatus; confidence:Confidence; reasons:Reason[];
 evidence:CompatibilityEvidence[]; dependencies:Dependency[]; dependencyResults:{componentId:string; status:string}[];
 knownIssues:string[]; actions:string[]; minimumVersion?:string; recommendedVersion?:string;
 maximumTestedVersion?:string; lastVerifiedAt:string|null; ageDays:number|null; stale:boolean;
 hardBlocker:boolean; unresolvedBreak:boolean; recordId?:string; sample:boolean;
}
export interface PreflightRecommendation {
 id:string; kind:'general'|'evidence'|'verify'; text:string; componentId?:string;
 reason?:Reason; evidence:CompatibilityEvidence[]; phase:'before'|'upgrade'|'after';
}
export interface PreflightResult {
 schemaVersion:1; engineVersion:string; generatedAt:string; vertical:Vertical;
 environment:PreflightEnvironment; target:PreflightTarget; overallVerdict:Verdict;
 confidence:Confidence; reasons:Reason[]; ruleIds:string[]; components:CompatibilityResult[];
 counts:Record<ComponentStatus,number>; recommendations:PreflightRecommendation[];
 sample:boolean; excluded:number; risk:{score:number; factors:Reason[]};
}
