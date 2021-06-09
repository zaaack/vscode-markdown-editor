// fix cannot find global
;(window as any)['global'] = window['global'] || globalThis
