import {
  DynamicModule,
  Module,
  type InjectionToken,
  type ModuleMetadata,
  type OptionalFactoryDependency,
} from '@nestjs/common';

import { EngineStatisticClient } from './engine-statistic-client';
import {
  ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS,
  type EngineStatisticClientModuleOptions,
} from './engine-statistic-client.options';

@Module({})
export class EngineStatisticClientModule {
  static forRoot(options: EngineStatisticClientModuleOptions): DynamicModule {
    return {
      module: EngineStatisticClientModule,
      global: true,
      providers: [
        { provide: ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS, useValue: options },
        EngineStatisticClient,
      ],
      exports: [EngineStatisticClient],
    };
  }

  static forRootAsync(options: {
    useFactory: (
      ...args: never[]
    ) => EngineStatisticClientModuleOptions | Promise<EngineStatisticClientModuleOptions>;
    inject?: Array<InjectionToken | OptionalFactoryDependency>;
    imports?: ModuleMetadata['imports'];
  }): DynamicModule {
    return {
      module: EngineStatisticClientModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: ENGINE_STATISTIC_CLIENT_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        EngineStatisticClient,
      ],
      exports: [EngineStatisticClient],
    };
  }
}
