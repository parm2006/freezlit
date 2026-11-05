"""On-demand spelling suggestions from Windows' installed dictionaries (no bundled word list)."""
import ctypes as C
import re
import sys
import uuid
import unicodedata


def suggestions(word, language='en-US'):
    if isinstance(word,str):word=unicodedata.normalize('NFC',word)
    if not isinstance(word,str) or not re.fullmatch(r"[^\W\d_]+(?:['’-][^\W\d_]+)*",word) or len(word)>128:
        raise ValueError('Select one word of at most 128 letters.')
    if not isinstance(language,str) or not re.fullmatch(r'[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?',language):
        raise ValueError('Invalid spelling language.')
    if sys.platform!='win32':
        return {'available':False,'suggestions':[]}
    ole=C.WinDLL('ole32')
    pointer=C.c_void_p
    hresult=C.c_long
    ole.CoInitializeEx.argtypes=[pointer,C.c_ulong];ole.CoInitializeEx.restype=hresult
    ole.CoUninitialize.argtypes=[];ole.CoUninitialize.restype=None
    ole.CoCreateInstance.argtypes=[pointer,pointer,C.c_ulong,pointer,C.POINTER(pointer)];ole.CoCreateInstance.restype=hresult
    ole.CoTaskMemFree.argtypes=[pointer];ole.CoTaskMemFree.restype=None
    initialized=ole.CoInitializeEx(None,2)
    if initialized<0 and initialized!=-2147417850:
        raise OSError('Windows spelling could not initialize.')
    owned=[]
    def call(obj,index,types,*args):
        table=C.cast(obj,C.POINTER(C.POINTER(pointer))).contents
        result=C.WINFUNCTYPE(hresult,pointer,*types)(table[index])(obj,*args)
        if result<0:raise OSError('Windows spelling lookup failed.')
        return result
    def interface(obj,index,types,*args):
        result=pointer();call(obj,index,[*types,C.POINTER(pointer)],*args,C.byref(result));owned.append(result);return result
    try:
        clsid=(C.c_byte*16).from_buffer_copy(uuid.UUID('7AB36653-1796-484B-BDFA-E74F1DB7C1DC').bytes_le)
        iid=(C.c_byte*16).from_buffer_copy(uuid.UUID('8E018A9D-2415-4677-BF08-794EA61F94BB').bytes_le)
        factory=pointer()
        if ole.CoCreateInstance(C.byref(clsid),None,1,C.byref(iid),C.byref(factory))<0:
            return {'available':False,'suggestions':[]}
        owned.append(factory)
        supported=C.c_int();call(factory,4,[C.c_wchar_p,C.POINTER(C.c_int)],language,C.byref(supported))
        if not supported.value:return {'available':False,'suggestions':[]}
        checker=interface(factory,5,[C.c_wchar_p],language)
        errors=interface(checker,4,[C.c_wchar_p],word)
        error=pointer();call(errors,3,[C.POINTER(pointer)],C.byref(error))
        if not error.value:return {'available':True,'correct':True,'suggestions':[]}
        owned.append(error)
        strings=interface(checker,5,[C.c_wchar_p],word)
        values=[]
        for _ in range(8):
            value=pointer();fetched=C.c_ulong()
            call(strings,3,[C.c_ulong,C.POINTER(pointer),C.POINTER(C.c_ulong)],1,C.byref(value),C.byref(fetched))
            if not fetched.value:break
            try:values.append(C.wstring_at(value))
            finally:ole.CoTaskMemFree(value)
        return {'available':True,'correct':False,'suggestions':values}
    finally:
        for obj in reversed(owned):
            if obj.value:call(obj,2,[])
        if initialized>=0:ole.CoUninitialize()
