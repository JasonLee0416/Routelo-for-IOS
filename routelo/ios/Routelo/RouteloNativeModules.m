#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppleVisionOcr, NSObject)

RCT_EXTERN_METHOD(recognizeText:(NSString *)uri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

@interface RCT_EXTERN_MODULE(RouteloImageOps, NSObject)

RCT_EXTERN_METHOD(manipulate:(NSString *)uri
                  actions:(NSArray *)actions
                  compress:(double)compress
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
