namespace RTLSDRWaterfall.Blazor;

using Microsoft.JSInterop;

public class WaterfallInterop
{
    private readonly IJSRuntime _js;

    public WaterfallInterop(IJSRuntime js)
    {
        _js = js;
    }

    public async Task DisplayRTLPowerData(string message)
    {
        var test = await _js.InvokeAsync<IJSObjectReference>("window.createWaterfall", "waterfall", "","", true, true, true);
    }
}